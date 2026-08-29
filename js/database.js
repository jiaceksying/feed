/**
 * Database.js — 后端 API 客户端（数据传输层）
 *
 * 角色：浏览器与后端（backend/ Java 服务）之间的 HTTP 传输层。
 * 设计：浏览器无法直接连 MySQL，所有读写都经此后端 API；
 *       后端数据库是唯一数据源（Single Source of Truth）。
 *
 * API 契约（与 backend/src/com/childdiary/ApiServer.java 对应）：
 *   GET    {apiBaseUrl}/health         探活
 *   GET    {apiBaseUrl}/records        拉取全部数据 {child, records, ...}
 *   PUT    {apiBaseUrl}/child          保存孩子档案（body: child）
 *   POST   {apiBaseUrl}/records        全量推送（body: {child, records}，覆盖）
 *   PUT    {apiBaseUrl}/records/:id    新增/更新单条记录（upsert）
 *   DELETE {apiBaseUrl}/records/:id    删除单条记录
 */

const DB_CONFIG = {
  // 后端 API 地址（绝对地址；前后端不在同一台服务器时使用）。
  // 已指向后端 HTTPS 端口 8443（自签证书），这样前端以 https 打开时不会被混合内容拦截。
  // 若后端未启用 HTTPS（server.ssl.enabled=false），请改回 http://8.156.64.159:8080/api。
  apiBaseUrl: 'https://8.156.64.159:8443/api',
  authToken: '',          // 可选：Bearer Token
  timeout: 15000,         // 请求超时（毫秒）
};

/* ================================================================
 *  ApiClient — 后端数据访问客户端（供 Store 调用）
 * ================================================================ */
const ApiClient = {
  /** 拉取全部数据（孩子档案 + 记录） */
  getRecords() {
    return this._request('GET', '/records');
  },

  /** 保存孩子档案 */
  putChild(profile) {
    return this._request('PUT', '/child', profile);
  },

  /** 新增/更新单条记录 */
  putRecord(id, record) {
    return this._request('PUT', `/records/${encodeURIComponent(id)}`, record);
  },

  /** 删除单条记录 */
  deleteRecord(id) {
    return this._request('DELETE', `/records/${encodeURIComponent(id)}`);
  },

  /** 全量推送（覆盖服务端） */
  replaceAll(child, records) {
    return this._request('POST', '/records', { child: child || null, records: records || [] });
  },

  /** 测试连接（探活） */
  async testConnection() {
    if (!DB_CONFIG.apiBaseUrl) {
      return { ok: false, message: '尚未配置后端地址（js/database.js 的 DB_CONFIG.apiBaseUrl）' };
    }
    try {
      const res = await fetch(this._base() + '/health', {
        headers: DB_CONFIG.authToken ? { Authorization: `Bearer ${DB_CONFIG.authToken}` } : {},
      });
      return res.ok
        ? { ok: true, message: '后端连接成功 ✅' }
        : { ok: false, message: `服务可达，但返回 HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: `连接失败：${err.message}` };
    }
  },

  /* ===== 底层请求 ===== */
  _base() {
    return DB_CONFIG.apiBaseUrl.replace(/\/+$/, '');
  },

  _request(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DB_CONFIG.timeout || 10000);

    return fetch(this._base() + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(DB_CONFIG.authToken ? { Authorization: `Bearer ${DB_CONFIG.authToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer)).then(async res => {
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) {}
        throw new Error(msg);
      }
      return res.json().catch(() => ({}));
    });
  },
};
