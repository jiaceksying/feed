/**
 * Storage.js — 数据层
 * 管理 localStorage 中的孩子档案和日常记录
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
    return record;
  },

  updateRecord(id, updates) {
    const records = this.getRecords();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return null;
    records[idx] = { ...records[idx], ...updates, id, updatedAt: new Date().toISOString() };
    localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records));
    return records[idx];
  },

  deleteRecord(id) {
    let records = this.getRecords();
    records = records.filter(r => r.id !== id);
    localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records));
  },

  /* ===== 批量操作 ===== */
  clearAllRecords() {
    localStorage.removeItem(this.KEYS.RECORDS);
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
