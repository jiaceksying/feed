package com.childdiary;

import com.sun.net.httpserver.HttpExchange;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.sql.Timestamp;

/**
 * HTTP / JSON / 类型转换工具集。
 */
public final class JsonUtil {

    private JsonUtil() {
    }

    /* ===== HTTP ===== */

    public static void cors(HttpExchange ex) {
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    public static String readBody(HttpExchange ex) throws IOException {
        try (InputStream in = ex.getRequestBody()) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) {
                buf.write(chunk, 0, n);
            }
            return buf.toString(StandardCharsets.UTF_8);
        }
    }

    public static void sendJson(HttpExchange ex, int status, Object json) throws IOException {
        byte[] bytes = json.toString().getBytes(StandardCharsets.UTF_8);
        cors(ex);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }

    public static void sendError(HttpExchange ex, int status, String message) throws IOException {
        JSONObject err = new JSONObject().put("ok", false).put("error", message);
        sendJson(ex, status, err);
    }

    public static JSONObject parseObject(String raw) {
        if (raw == null || raw.isBlank()) {
            return new JSONObject();
        }
        Object v = new JSONTokener(raw).nextValue();
        if (v instanceof JSONObject o) {
            return o;
        }
        throw new IllegalArgumentException("请求体必须是 JSON 对象");
    }

    /* ===== JSON 读写辅助 ===== */

    /** 从请求 JSON 取值：缺失或 null 返回 org.json 的 NULL（便于统一写库判空） */
    public static Object nullable(JSONObject o, String key) {
        Object v = o.opt(key);
        return v == null || v == JSONObject.NULL ? JSONObject.NULL : v;
    }

    /** 数据库 JSON 列文本 → org.json 结构（数组/对象），空则返回 NULL */
    public static Object fromJsonColumn(String s) {
        if (s == null || s.isBlank()) {
            return JSONObject.NULL;
        }
        String t = s.trim();
        if (t.startsWith("[")) {
            return new JSONArray(t);
        }
        if (t.startsWith("{")) {
            return new JSONObject(t);
        }
        return new JSONArray().put(t); // 兜底：按单元素数组处理
    }

    /** 请求中的任意 JSON 值 → 可直接写入 JSON 列的文本；NULL 返回 null */
    public static String toJsonColumn(Object v) {
        if (v == null || v == JSONObject.NULL) {
            return null;
        }
        String s = v.toString();
        return s.isBlank() || "null".equals(s) ? null : s;
    }

    /* ===== 类型转换（前端值 → SQL） ===== */

    /** 前端 date（"yyyy-MM-dd" 或 ISO 时间）→ java.sql.Date */
    public static java.sql.Date toDate(Object v, java.sql.Date fallback) {
        if (v == null || v == JSONObject.NULL) {
            return fallback;
        }
        try {
            String s = v.toString().trim();
            if (s.length() > 10) {
                s = s.substring(0, 10);
            }
            return java.sql.Date.valueOf(LocalDate.parse(s));
        } catch (Exception e) {
            return fallback;
        }
    }

    /** 前端数字（可能为字符串）→ Double，缺失/非法返回 null */
    public static Double toDouble(Object v) {
        if (v == null || v == JSONObject.NULL) {
            return null;
        }
        try {
            String s = v.toString().trim();
            return s.isEmpty() ? null : Double.parseDouble(s);
        } catch (Exception e) {
            return null;
        }
    }

    /** 前端时间（ISO-8601 / yyyy-MM-dd HH:mm:ss）→ Timestamp，解析失败用当前时间 */
    public static Timestamp toTimestamp(Object v) {
        if (v != null && v != JSONObject.NULL) {
            try {
                return Timestamp.from(Instant.parse(v.toString()));
            } catch (Exception ignore) {
                try {
                    LocalDateTime ldt = LocalDateTime.parse(v.toString(),
                            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                    return Timestamp.valueOf(ldt);
                } catch (Exception ignore2) {
                    // 落到当前时间
                }
            }
        }
        return Timestamp.from(Instant.now());
    }

    /** Timestamp → 前端使用的 ISO-8601 字符串 */
    public static String toIsoString(Timestamp ts) {
        return ts == null ? null : ts.toInstant().toString();
    }
}
