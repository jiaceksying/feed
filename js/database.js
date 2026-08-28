/**
 * Database.js — 数据库同步层
 *
 * 作用：
 *   1. 预留数据库连接配置（DB_CONFIG），后续填写即可启用数据库写入；
 *   2. 所有本地写操作（档案 / 记录增删改 / 导入 / 清空）会自动进入同步队列；
 *   3. 连接未配置时队列静默积压，不影响 localStorage 正常使用；
 *   4. 连接配置好后，可自动或手动（设置页「立即同步」）将队列写入数据库。
 *
 * 说明：
 *   浏览器无法直接连接 MySQL/PostgreSQL 等数据库，
 *   推荐通过后端 API（type: 'http'）中转写入，建表脚本见 database/schema.sql。
 *   若后续采用 WebSocket 网关 / sql.js 等直连方案，填写 DB_CONFIG.direct 并扩展适配器即可。
 */

/* ================================================================
 *  ★ 预留数据库连接配置 —— 后续在此填写 ★
 * ================================================================ */
const DB_CONFIG = {
  // 是否启用数据库同步（填写好连接信息后改为 true）
  enabled: true,

  // ---- 方案一（推荐）：通过后端 API 写入数据库 ----
  // 后端为 Java 实现，见 backend/ 目录（启动方式：运行 backend/start.bat）
  type: 'http',
  apiBaseUrl: 'http://8.156.64.159:8080/api',  // Java 后端地址
  authToken: '',         // Bearer Token（可选）
  timeout: 15000,        // 请求超时（毫秒）

  // ---- 方案二：直连参数（已废弃）----
  // 浏览器无法直连数据库，实际连接信息统一由 Java 后端管理，
  // 见 backend/application.properties（此处不再保存任何密码）。
  direct: {
    driver: 'mysql',
    host: '',
    port: 3306,
    database: '',
    username: '',
    password: '',
  },

  // 同步成功后是否自动清空队列
  autoFlush: true,
};

/* ================================================================
 *  Database — 数据库读写适配器
 * ================================================================ */
const Database = {
  QUEUE_KEY: 'childDiary.dbQueue',
  API_PATHS: {
    child: '/child',            // PUT  保存孩子档案
    records: '/records',        // GET  拉取全部记录 / POST 批量写入
    record: (id) => `/records/${id}`, // PUT 更新 / DELETE 删除单条
  },

  /* ===== 连接状态 ===== */
  isConfigured() {
    return !!(DB_CONFIG.enabled && DB_CONFIG.type === 'http' && DB_CONFIG.apiBaseUrl);
  },

  getStatus() {
    return {
      configured: this.isConfigured(),
      apiBaseUrl: DB_CONFIG.apiBaseUrl,
      pending: this._queue().length,
    };
  },

  /* ===== 同步队列（localStorage 持久化，离线安全）===== */
  _queue() {
    try {
      return JSON.parse(localStorage.getItem(this.QUEUE_KEY)) || [];
    } catch (e) {
      return [];
    }
  },

  _saveQueue(queue) {
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
  },

  /**
   * 入队一个写操作（由 storage.js 在每次本地写入后调用）
   * @param {string} op  操作类型：'saveChild' | 'upsertRecord' | 'deleteRecord' | 'replaceAll'
   * @param {*} payload  操作数据
   */
  enqueue(op, payload) {
    const queue = this._queue();
    // 同一记录的重复操作去重：只保留最新一条
    if (op === 'upsertRecord' || op === 'deleteRecord') {
      const key = `${op}:${payload.id}`;
      const idx = queue.findIndex(item => `${item.op}:${item.payload.id}` === key);
      if (idx !== -1) queue.splice(idx, 1);
    }
    if (op === 'replaceAll') {
      // 全量替换时清空此前的增量队列
      queue.length = 0;
    }
    queue.push({ op, payload, enqueuedAt: new Date().toISOString() });
    this._saveQueue(queue);

    if (DB_CONFIG.autoFlush) this.flush(); // 未配置连接时 flush 内部静默跳过
  },

  /**
   * 将队列写入数据库（连接未配置时静默跳过）
   * @returns {Promise<{synced: number, failed: number}>}
   */
  async flush() {
    if (!this.isConfigured()) return { synced: 0, failed: 0, skipped: true };

    const queue = this._queue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;
    const remain = [];

    for (const item of queue) {
      try {
        await this._execute(item);
        synced++;
      } catch (err) {
        console.warn('[Database] 同步失败，已保留在队列中：', item.op, err.message);
        remain.push(item);
        failed++;
      }
    }
    this._saveQueue(remain);
    return { synced, failed };
  },

  /* ===== API 执行器（后续填写 apiBaseUrl 后即生效）===== */
  async _execute(item) {
    const { op, payload } = item;
    switch (op) {
      case 'saveChild':
        return this._request('PUT', this.API_PATHS.child, payload);
      case 'upsertRecord':
        return this._request('PUT', this.API_PATHS.record(payload.id), payload);
      case 'deleteRecord':
        return this._request('DELETE', this.API_PATHS.record(payload.id));
      case 'replaceAll':
        return this._request('POST', this.API_PATHS.records, payload); // payload: { child, records }
      default:
        throw new Error(`未知操作类型: ${op}`);
    }
  },

  _request(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DB_CONFIG.timeout || 10000);

    return fetch(DB_CONFIG.apiBaseUrl.replace(/\/+$/, '') + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(DB_CONFIG.authToken ? { Authorization: `Bearer ${DB_CONFIG.authToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer)).then(async res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json().catch(() => ({}));
    });
  },

  /* ===== 主动操作（设置页按钮）===== */

  /** 测试连接：GET {apiBaseUrl}/health，也可改为任意探活端点 */
  async testConnection() {
    if (!DB_CONFIG.apiBaseUrl) {
      return { ok: false, message: '尚未填写数据库连接（js/database.js 中的 DB_CONFIG）' };
    }
    try {
      const res = await fetch(DB_CONFIG.apiBaseUrl.replace(/\/+$/, '') + '/health', {
        headers: DB_CONFIG.authToken ? { Authorization: `Bearer ${DB_CONFIG.authToken}` } : {},
      });
      return res.ok
        ? { ok: true, message: '连接成功 ✅' }
        : { ok: false, message: `服务可达，但返回 HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: `连接失败：${err.message}` };
    }
  },

  /** 全量推送：把本地全部数据一次性写入数据库 */
  async pushAll() {
    if (!this.isConfigured()) {
      return { ok: false, message: '请先在 js/database.js 中填写 DB_CONFIG 并将 enabled 改为 true' };
    }
    try {
      await this._request('POST', this.API_PATHS.records, Store.getAllData());
      this._saveQueue([]); // 全量已推送，清空增量队列
      return { ok: true, message: '全量推送成功 ✅' };
    } catch (err) {
      return { ok: false, message: `推送失败：${err.message}` };
    }
  },

  /** 从数据库拉取全部数据（当前以本地为准，拉取结果暂存备用）*/
  async pullAll() {
    if (!this.isConfigured()) {
      return { ok: false, message: '请先在 js/database.js 中填写 DB_CONFIG 并将 enabled 改为 true' };
    }
    try {
      const data = await this._request('GET', this.API_PATHS.records);
      return { ok: true, message: '拉取成功 ✅', data };
    } catch (err) {
      return { ok: false, message: `拉取失败：${err.message}` };
    }
  },

  /** 清空同步队列（危险：丢弃未同步的写操作）*/
  clearQueue() {
    this._saveQueue([]);
  },
};
