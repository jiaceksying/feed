/**
 * Storage.js — 数据层
 * 管理 localStorage 中的孩子档案和日常记录
 * 双写机制：本地写入成功后，同步入队 Database（js/database.js），
 * 连接配置好后自动写入数据库（未配置时队列静默积压，不影响使用）
 */

const Store = {
  KEYS: {
    CHILD: 'childDiary.child',
    RECORDS: 'childDiary.records',
  },

  /* ===== 孩子档案 ===== */
  getChild() {
    const raw = localStorage.getItem(this.KEYS.CHILD);
    return raw ? JSON.parse(raw) : null;
  },

  saveChild(profile) {
    localStorage.setItem(this.KEYS.CHILD, JSON.stringify(profile));
    this._sync('saveChild', profile);
  },

  /* ===== 记录 CRUD ===== */
  getRecords() {
    const raw = localStorage.getItem(this.KEYS.RECORDS);
    let records = raw ? JSON.parse(raw) : [];
    // 按日期降序排列（最新在前）
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    return records;
  },

  getRecord(id) {
    return this.getRecords().find(r => r.id === id);
  },

  addRecord(record) {
    const records = this.getRecords();
    record.id = this._genId();
    record.createdAt = new Date().toISOString();
    record.updatedAt = record.createdAt;
    records.push(record);
    localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records));
    this._sync('upsertRecord', record);
    return record;
  },

  updateRecord(id, updates) {
    const records = this.getRecords();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return null;
    records[idx] = { ...records[idx], ...updates, id, updatedAt: new Date().toISOString() };
    localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records));
    this._sync('upsertRecord', records[idx]);
    return records[idx];
  },

  deleteRecord(id) {
    let records = this.getRecords();
    records = records.filter(r => r.id !== id);
    localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records));
    this._sync('deleteRecord', { id });
  },

  /* ===== 批量操作 ===== */
  clearAllRecords() {
    localStorage.removeItem(this.KEYS.RECORDS);
    this._sync('replaceAll', { child: this.getChild(), records: [] });
  },

  getAllData() {
    return {
      child: this.getChild(),
      records: this.getRecords(),
      exportDate: new Date().toISOString(),
      version: '1.0',
    };
  },

  importData(data) {
    if (!data || typeof data !== 'object') throw new Error('数据格式不正确');
    if (data.child) this.saveChild(data.child);
    if (Array.isArray(data.records)) {
      localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(data.records));
      this._sync('replaceAll', { child: this.getChild(), records: data.records });
    }
  },

  /* ===== 数据库同步（双写）===== */
  _sync(op, payload) {
    if (typeof Database !== 'undefined' && Database.enqueue) {
      Database.enqueue(op, payload);
    }
  },

  /* ===== 工具方法 ===== */
  _genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  },

  /**
   * 图片压缩 — 将 File 转为压缩后的 base64
   * 限制最大宽度 800px，质量 0.7，避免 localStorage 溢出
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
