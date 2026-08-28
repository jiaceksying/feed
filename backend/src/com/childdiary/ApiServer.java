package com.childdiary;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.Executors;

/**
 * HTTP API + 前端静态资源服务器。
 *
 * API 契约（与 js/database.js 对应）：
 *   GET    /api/health        探活
 *   GET    /api/child         读取孩子档案
 *   PUT    /api/child         保存孩子档案（body: child 对象）
 *   GET    /api/records       拉取全部数据 {child, records, ...}
 *   POST   /api/records       全量推送（body: {child, records}，覆盖服务端）
 *   PUT    /api/records/{id}  新增/更新单条记录（upsert）
 *   DELETE /api/records/{id}  删除单条记录
 *
 * 其余路径按静态文件处理（默认托管项目根目录的前端）。
 */
public final class ApiServer {

    private final Config cfg;

    public ApiServer(Config cfg) {
        this.cfg = cfg;
    }

    public void start() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(cfg.host(), cfg.port()), 0);
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.createContext("/", this::handle);
        server.start();
        System.out.println("=====================================================");
        System.out.println(" 童心日记后端已启动");
        System.out.println("   地址     : http://localhost:" + cfg.port() + "/");
        System.out.println("   API 前缀 : http://localhost:" + cfg.port() + "/api");
        System.out.println("   前端目录 : " + Paths.get(cfg.frontendDir()).toAbsolutePath().normalize());
        System.out.println("   数据库   : " + cfg.dbHost() + ":" + cfg.dbPort() + "/" + cfg.dbName());
        System.out.println("=====================================================");
    }

    private void handle(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        String method = ex.getRequestMethod();

        // CORS 预检
        if ("OPTIONS".equalsIgnoreCase(method)) {
            JsonUtil.cors(ex);
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return;
        }

        try {
            if (path.startsWith("/api/")) {
                handleApi(ex, method, path);
            } else {
                handleStatic(ex, path);
            }
        } catch (IllegalArgumentException e) {
            JsonUtil.sendError(ex, 400, e.getMessage());
        } catch (Exception e) {
            System.err.println("[API] " + method + " " + path + " 失败: " + e);
            JsonUtil.sendError(ex, 500, "服务器内部错误: " + e.getMessage());
        } finally {
            ex.close();
        }
    }

    /* ================= API 路由 ================= */

    private void handleApi(HttpExchange ex, String method, String path) throws Exception {
        String route = path.substring("/api".length()); // 去掉 /api 前缀

        // /api/health
        if (route.equals("/health") && isGet(method)) {
            JSONObject body = new JSONObject()
                    .put("status", "ok")
                    .put("db", pingDb())
                    .put("time", Instant.now().toString());
            JsonUtil.sendJson(ex, 200, body);
            return;
        }

        // /api/child
        if (route.equals("/child")) {
            try (Connection conn = Db.connect()) {
                if (isGet(method)) {
                    JSONObject child = ChildDao.get(conn);
                    JsonUtil.sendJson(ex, 200, child == null
                            ? new JSONObject().put("ok", true).put("child", JSONObject.NULL)
                            : child);
                } else if ("PUT".equalsIgnoreCase(method) || "POST".equalsIgnoreCase(method)) {
                    JSONObject child = JsonUtil.parseObject(JsonUtil.readBody(ex));
                    JSONObject saved = ChildDao.upsert(conn, child);
                    RecordDao.logSync(conn, null, "saveChild", child);
                    JsonUtil.sendJson(ex, 200, new JSONObject().put("ok", true).put("child", saved));
                } else {
                    JsonUtil.sendError(ex, 405, "不支持的请求方法: " + method);
                }
            }
            return;
        }

        // /api/records
        if (route.equals("/records")) {
                if (isGet(method)) {
                    try (Connection conn = Db.connect()) {
                        JSONObject child = ChildDao.get(conn);
                        JSONObject data = new JSONObject()
                                .put("records", RecordDao.findAllAsArray(conn))
                                .put("exportDate", Instant.now().toString())
                                .put("version", "1.0");
                        data.put("child", child == null ? JSONObject.NULL : child);
                        JsonUtil.sendJson(ex, 200, data);
                    }
                } else if ("POST".equalsIgnoreCase(method)) {
                // 全量推送（replaceAll）
                JSONObject body = JsonUtil.parseObject(JsonUtil.readBody(ex));
                Object childObj = body.opt("child");
                JSONArray recordsArr = body.optJSONArray("records");
                try (Connection conn = Db.connect()) {
                    conn.setAutoCommit(false);
                    try {
                        if (childObj instanceof JSONObject c) {
                            ChildDao.upsert(conn, c);
                        }
                        RecordDao.replaceAll(conn, toList(recordsArr));
                        conn.commit();
                    } catch (Exception e) {
                        conn.rollback();
                        throw e;
                    } finally {
                        conn.setAutoCommit(true);
                    }
                    RecordDao.logSync(conn, null, "replaceAll", null);
                    JsonUtil.sendJson(ex, 200, new JSONObject().put("ok", true)
                            .put("count", recordsArr == null ? 0 : recordsArr.length()));
                }
            } else {
                JsonUtil.sendError(ex, 405, "不支持的请求方法: " + method);
            }
            return;
        }

        // /api/records/{id}
        if (route.startsWith("/records/")) {
            String id = route.substring("/records/".length());
            if (id.isBlank() || id.contains("/")) {
                JsonUtil.sendError(ex, 400, "非法记录 ID");
                return;
            }
            try (Connection conn = Db.connect()) {
                if ("PUT".equalsIgnoreCase(method) || "POST".equalsIgnoreCase(method)) {
                    JSONObject record = JsonUtil.parseObject(JsonUtil.readBody(ex));
                    record.put("id", id);
                    RecordDao.upsert(conn, record);
                    RecordDao.logSync(conn, id, "upsertRecord", record);
                    JsonUtil.sendJson(ex, 200, new JSONObject().put("ok", true).put("id", id));
                } else if ("DELETE".equalsIgnoreCase(method)) {
                    boolean removed = RecordDao.delete(conn, id);
                    RecordDao.logSync(conn, id, "deleteRecord", null);
                    JsonUtil.sendJson(ex, 200, new JSONObject().put("ok", true)
                            .put("id", id).put("removed", removed));
                } else {
                    JsonUtil.sendError(ex, 405, "不支持的请求方法: " + method);
                }
            }
            return;
        }

        JsonUtil.sendError(ex, 404, "接口不存在: " + path);
    }

    private static boolean isGet(String method) {
        return "GET".equalsIgnoreCase(method);
    }

    private static java.util.List<JSONObject> toList(JSONArray arr) {
        java.util.List<JSONObject> list = new java.util.ArrayList<>();
        if (arr != null) {
            for (int i = 0; i < arr.length(); i++) {
                Object v = arr.opt(i);
                if (v instanceof JSONObject o) {
                    list.add(o);
                }
            }
        }
        return list;
    }

    private boolean pingDb() {
        try (Connection conn = Db.connect();
             var st = conn.createStatement();
             var rs = st.executeQuery("SELECT 1")) {
            return rs.next();
        } catch (Exception e) {
            return false;
        }
    }

    /* ================= 静态资源 ================= */

    private void handleStatic(HttpExchange ex, String path) throws IOException {
        Path root = Paths.get(cfg.frontendDir()).toAbsolutePath().normalize();
        String rel = path.equals("/") ? "/index.html" : path;

        Path target = root.resolve(rel.substring(1)).normalize();
        if (!target.startsWith(root) || !Files.isRegularFile(target)) {
            JsonUtil.cors(ex);
            byte[] msg = "404 Not Found".getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(404, msg.length);
            try (OutputStream out = ex.getResponseBody()) {
                out.write(msg);
            }
            return;
        }

        String type = contentType(target.getFileName().toString());
        byte[] bytes = Files.readAllBytes(target);
        JsonUtil.cors(ex);
        ex.getResponseHeaders().set("Content-Type", type);
        ex.getResponseHeaders().set("Cache-Control", "no-cache");
        ex.sendResponseHeaders(200, bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }

    private static String contentType(String name) {
        String n = name.toLowerCase();
        if (n.endsWith(".html") || n.endsWith(".htm")) return "text/html; charset=utf-8";
        if (n.endsWith(".css"))  return "text/css; charset=utf-8";
        if (n.endsWith(".js"))   return "application/javascript; charset=utf-8";
        if (n.endsWith(".json")) return "application/json; charset=utf-8";
        if (n.endsWith(".svg"))  return "image/svg+xml";
        if (n.endsWith(".png"))  return "image/png";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        if (n.endsWith(".gif"))  return "image/gif";
        if (n.endsWith(".ico"))  return "image/x-icon";
        if (n.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }
}
