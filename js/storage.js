/**
 * Storage.js — 后端数据库驱动的数据层
 *
 * 设计原则：后端数据库（backend/ 的 MySQL）是唯一数据源（Single Source of Truth）。
 *
 * 读取：内存缓存（启动时 Store.load() 从后端 GET /api/records 拉取；写操作后即时更新）。
 *       同步读方法（getChild / getRecords / getRecord）直接返回内存缓存，供 UI 即时渲染。
 * 写入：直接调用后端 API（ApiClient）写库，成功后更新内存缓存，
 *       并镜像到 localStorage 作为「离线查看缓存」。
 * 离线：后端不可达时，写操作进入 pending 队列（localStorage），恢复后自动重试；
 *       启动时若后端不可用，则回退展示 localStorage 镜像，保证页面可用。
 *
 * 依赖：js/database.js 中的 ApiClient 与 DB_CONFIG。
 */

const Store = {
  KEYS: {
    CHILD: 'childDiary.child',     // 离线查看缓存：孩子档案
    RECORDS: 'childDiary.records', // 离线查看缓存：记录
    PENDING: 'childDiary.pending', // 离线待重试写队列
  },

  // 内存缓存（同步读来源）
  _child: null,
  _records: [],
  _loaded: false,
  online: true, // 最近一次与后端通信是否成功

  /* ================================================================
   *  初始化：从后端拉取全部数据
   * ================================================================ */
  async load() {
    try {
      const data = await ApiClient.getRecords();
      this._child = data.child || null;
      this._records = Array.isArray(data.records) ? data.records : [];
      this._sort();
      this._loaded = true;
      this.online = true;
      this._mirror();
      await this._flushPending(); // 后端可用时，补推离线积压的写操作
      return { ok: true, offline: false };
    } catch (err) {
      // 后端不可用：回退到本地镜像，保证页面可展示
      this._restoreMirror();
      this._loaded = true;
      this.online = false;
      return { ok: false, offline: true, error: err.message };
    }
  },

  isLoaded() { return this._loaded; },
  isOnline() { return this.online; },
  pendingCount() { return this._pending().length; },

  /* ================================================================
   *  同步读（来自内存缓存）
   * ================================================================ */
  getChild() { return this._child; },

  getRecords() { return this._records; },

  getRecord(id) { return this._records.find(r => r.id === id) || null; },

  /* ================================================================
   *  孩子档案
   * ================================================================ */
  async saveChild(profile) {
    this._child = profile; // 乐观更新
    try {
      const saved = await ApiClient.putChild(profile);
      this._child = (saved && saved.child) || profile;
      this.online = true;
      this._mirror();
      return this._child;
    } catch (err) {
      this._queuePending('saveChild', profile);
      this.online = false;
      throw err;
    }
  },

  /* ================================================================
   *  记录 CRUD（均写后端）
   * ================================================================ */
  async addRecord(record) {
    record = { ...record };
    record.id = record.id || this._genId();
    record.createdAt = record.createdAt || new Date().toISOString();
    record.updatedAt = record.updatedAt || record.createdAt;
    try {
      await ApiClient.putRecord(record.id, record);
      this._records.push(record);
      this._sort();
      this.online = true;
      this._mirror();
      return record;
    } catch (err) {
      // 离线时仍先入缓存以便展示，并记录待重试
      this._records.push(record);
      this._sort();
      this._queuePending('upsertRecord', record);
      this.online = false;
      throw err;
    }
  },

  async updateRecord(id, updates) {
    const idx = this._records.findIndex(r => r.id === id);
    const merged = idx === -1
      ? { ...updates, id, updatedAt: new Date().toISOString() }
      : { ...this._records[idx], ...updates, id, updatedAt: new Date().toISOString() };
    try {
      await ApiClient.putRecord(id, merged);
      if (idx === -1) this._records.push(merged); else this._records[idx] = merged;
      this._sort();
      this.online = true;
      this._mirror();
      return merged;
    } catch (err) {
      this._queuePending('upsertRecord', merged);
      this.online = false;
      throw err;
    }
  },

  async deleteRecord(id) {
    const before = this._records.slice();
    this._records = this._records.filter(r => r.id !== id);
    this._mirror();
    try {
      await ApiClient.deleteRecord(id);
      this.online = true;
    } catch (err) {
      this._queuePending('deleteRecord', { id });
      this._records = before; // 回滚
      this._mirror();
      this.online = false;
      throw err;
    }
  },

  async clearAllRecords() {
    this._records = [];
    this._mirror();
    try {
      await ApiClient.replaceAll(this._child, []);
      this.online = true;
    } catch (err) {
      this._queuePending('replaceAll', { child: this._child, records: [] });
      this.online = false;
      throw err;
    }
  },

  async importData(data) {
    if (!data || typeof data !== 'object') throw new Error('数据格式不正确');
    const child = data.child || this._child;
    const records = (Array.isArray(data.records) ? data.records : []).map(r => ({ ...r, id: r.id || this._genId() }));
    try {
      await ApiClient.replaceAll(child, records);
      this._child = child;
      this._records = records;
      this._sort();
      this.online = true;
      this._mirror();
      return { ok: true };
    } catch (err) {
      this._queuePending('replaceAll', { child, records });
      this.online = false;
      throw err;
    }
  },

  /** 用当前内存数据全量覆盖后端（设置页「全量推送」） */
  async pushAll() {
    await ApiClient.replaceAll(this._child, this._records);
    this.online = true;
    return { ok: true, message: '已用本地数据覆盖后端 ✅' };
  },

  getAllData() {
    return {
      child: this._child,
      records: this._records,
      exportDate: new Date().toISOString(),
      version: '1.0',
    };
  },

  /* ================================================================
   *  离线支持
   * ================================================================ */
  _pending() {
    try { return JSON.parse(localStorage.getItem(this.KEYS.PENDING) || '[]'); }
    catch (e) { return []; }
  },

  _queuePending(op, payload) {
    try {
      const q = this._pending();
      const key = `${op}:${payload && payload.id}`;
      const i = q.findIndex(it => `${it.op}:${it.payload && it.payload.id}` === key);
      if (i !== -1) q.splice(i, 1);          // 去重：同一记录只保留最新操作
      if (op === 'replaceAll') q.length = 0;  // 全量替换清掉之前的增量
      q.push({ op, payload, enqueuedAt: new Date().toISOString() });
      localStorage.setItem(this.KEYS.PENDING, JSON.stringify(q));
    } catch (e) { /* 容量超限等忽略 */ }
  },

  async _flushPending() {
    const q = this._pending();
    if (!q.length) return;
    const remain = [];
    for (const item of q) {
      try {
        switch (item.op) {
          case 'saveChild': this._child = (await ApiClient.putChild(item.payload)).child || item.payload; break;
          case 'upsertRecord': await ApiClient.putRecord(item.payload.id, item.payload); break;
          case 'deleteRecord': await ApiClient.deleteRecord(item.payload.id); break;
          case 'replaceAll': await ApiClient.replaceAll(item.payload.child, item.payload.records); break;
        }
      } catch (e) {
        remain.push(item); // 仍失败则保留，待下次重试
      }
    }
    localStorage.setItem(this.KEYS.PENDING, JSON.stringify(remain));
    if (remain.length === 0) {
      // 队列清空后重新拉取，确保与服务端一致
      try {
        const d = await ApiClient.getRecords();
        this._child = d.child || null;
        this._records = Array.isArray(d.records) ? d.records : [];
        this._sort();
        this._mirror();
      } catch (e) { /* 忽略 */ }
    }
  },

  /* ================================================================
   *  镜像 / 排序 / 工具
   * ================================================================ */
  _sort() {
    this._records.sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  _mirror() {
    try {
      localStorage.setItem(this.KEYS.CHILD, JSON.stringify(this._child));
      localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(this._records));
    } catch (e) { /* 容量超限等忽略 */ }
  },

  _restoreMirror() {
    try {
      this._child = JSON.parse(localStorage.getItem(this.KEYS.CHILD) || 'null');
      this._records = JSON.parse(localStorage.getItem(this.KEYS.RECORDS) || '[]') || [];
      this._sort();
    } catch (e) { /* 忽略 */ }
  },

  _genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  },

  /**
   * 图片压缩 — 将 File 转为压缩后的 base64
   * 限制最大宽度 800px，质量 0.7，避免数据过大
   */
  compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('请选择图片文件'));
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  },
};
