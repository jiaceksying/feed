package com.childdiary;

import org.json.JSONArray;
import org.json.JSONObject;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/**
 * 日常记录 DAO —— 与前端 Record 字段一一对应。
 * 喂奶 milkFeeds / 大小便 diaperChanges / 辅食 solidFoods / 照片 photos
 * 以 JSON 列整体存储，字段明细见 database/schema.sql。
 */
public final class RecordDao {

    private static final String UPSERT_SQL = """
            INSERT INTO records
              (id, record_date, mood, height, weight, sleep_hours, tags, activities,
               breakfast, lunch, dinner, snacks, milestones, notes,
               milk_feeds, diaper_changes, solid_foods, photos, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE
              record_date = VALUES(record_date), mood = VALUES(mood), height = VALUES(height),
              weight = VALUES(weight), sleep_hours = VALUES(sleep_hours), tags = VALUES(tags),
              activities = VALUES(activities), breakfast = VALUES(breakfast), lunch = VALUES(lunch),
              dinner = VALUES(dinner), snacks = VALUES(snacks), milestones = VALUES(milestones),
              notes = VALUES(notes), milk_feeds = VALUES(milk_feeds),
              diaper_changes = VALUES(diaper_changes), solid_foods = VALUES(solid_foods),
              photos = VALUES(photos), updated_at = VALUES(updated_at)
            """;

    private RecordDao() {
    }

    /** 新增/更新一条记录（以 id 为准 upsert） */
    public static void upsert(Connection conn, JSONObject r) throws SQLException {
        String id = r.optString("id", null);
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("记录缺少 id");
        }
        java.sql.Date recordDate = JsonUtil.toDate(r.opt("date"),
                java.sql.Date.valueOf(java.time.LocalDate.now()));
        Timestamp now = Timestamp.from(java.time.Instant.now());
        Timestamp createdAt = JsonUtil.toTimestamp(r.opt("createdAt"));

        try (PreparedStatement ps = conn.prepareStatement(UPSERT_SQL)) {
            ps.setString(1, id);
            ps.setDate(2, recordDate);
            ps.setString(3, JsonUtil.toJsonColumn(r.opt("mood")) == null ? null : r.optString("mood"));
            setNullableDouble(ps, 4, JsonUtil.toDouble(r.opt("height")));
            setNullableDouble(ps, 5, JsonUtil.toDouble(r.opt("weight")));
            setNullableDouble(ps, 6, JsonUtil.toDouble(r.opt("sleepHours")));
            ps.setString(7, JsonUtil.toJsonColumn(r.opt("tags")));
            ps.setString(8, JsonUtil.toJsonColumn(r.opt("activities")));
            ps.setString(9, JsonUtil.toJsonColumn(r.opt("breakfast")));
            ps.setString(10, JsonUtil.toJsonColumn(r.opt("lunch")));
            ps.setString(11, JsonUtil.toJsonColumn(r.opt("dinner")));
            ps.setString(12, JsonUtil.toJsonColumn(r.opt("snacks")));
            ps.setString(13, JsonUtil.toJsonColumn(r.opt("milestones")));
            ps.setString(14, JsonUtil.toJsonColumn(r.opt("notes")));
            ps.setString(15, JsonUtil.toJsonColumn(r.opt("milkFeeds")));
            ps.setString(16, JsonUtil.toJsonColumn(r.opt("diaperChanges")));
            ps.setString(17, JsonUtil.toJsonColumn(r.opt("solidFoods")));
            ps.setString(18, JsonUtil.toJsonColumn(r.opt("photos")));
            ps.setTimestamp(19, createdAt == null ? now : createdAt);
            ps.setTimestamp(20, now);
            ps.executeUpdate();
        }
    }

    /** 查询全部记录（按记录日期倒序，最新在前） */
    public static List<JSONObject> findAll(Connection conn) throws SQLException {
        String sql = "SELECT * FROM records ORDER BY record_date DESC, created_at DESC";
        List<JSONObject> list = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql); ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(fromRow(rs));
            }
        }
        return list;
    }

    /** 删除单条记录，返回是否删除 */
    public static boolean delete(Connection conn, String id) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("DELETE FROM records WHERE id = ?")) {
            ps.setString(1, id);
            return ps.executeUpdate() > 0;
        }
    }

    /** 全量替换（清空后重新写入） */
    public static void replaceAll(Connection conn, List<JSONObject> records) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("DELETE FROM records")) {
            ps.executeUpdate();
        }
        for (JSONObject r : records) {
            upsert(conn, r);
        }
    }

    /* ===== 行 → JSON ===== */

    private static JSONObject fromRow(ResultSet rs) throws SQLException {
        JSONObject r = new JSONObject();
        r.put("id", rs.getString("id"));
        java.sql.Date d = rs.getDate("record_date");
        r.put("date", d == null ? JSONObject.NULL : d.toString());
        putString(r, "mood", rs.getString("mood"));
        putDouble(r, "height", rs, "height");
        putDouble(r, "weight", rs, "weight");
        putDouble(r, "sleepHours", rs, "sleep_hours");
        r.put("tags", JsonUtil.fromJsonColumn(rs.getString("tags")));
        putString(r, "activities", rs.getString("activities"));
        putString(r, "breakfast", rs.getString("breakfast"));
        putString(r, "lunch", rs.getString("lunch"));
        putString(r, "dinner", rs.getString("dinner"));
        putString(r, "snacks", rs.getString("snacks"));
        putString(r, "milestones", rs.getString("milestones"));
        putString(r, "notes", rs.getString("notes"));
        r.put("milkFeeds", JsonUtil.fromJsonColumn(rs.getString("milk_feeds")));
        r.put("diaperChanges", JsonUtil.fromJsonColumn(rs.getString("diaper_changes")));
        r.put("solidFoods", JsonUtil.fromJsonColumn(rs.getString("solid_foods")));
        r.put("photos", JsonUtil.fromJsonColumn(rs.getString("photos")));
        r.put("createdAt", JsonUtil.toIsoString(rs.getTimestamp("created_at")));
        r.put("updatedAt", JsonUtil.toIsoString(rs.getTimestamp("updated_at")));
        return r;
    }

    private static void putString(JSONObject r, String key, String v) {
        r.put(key, v == null ? JSONObject.NULL : v);
    }

    private static void putDouble(JSONObject r, String key, ResultSet rs, String col) throws SQLException {
        double v = rs.getDouble(col);
        r.put(key, rs.wasNull() ? JSONObject.NULL : v);
    }

    private static void setNullableDouble(PreparedStatement ps, int idx, Double v) throws SQLException {
        if (v == null) {
            ps.setNull(idx, java.sql.Types.DECIMAL);
        } else {
            ps.setDouble(idx, v);
        }
    }

    /** 记录同步日志（便于排查） */
    public static void logSync(Connection conn, String recordId, String op, Object payload) {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO sync_log (record_id, op, payload) VALUES (?, ?, ?)")) {
            ps.setString(1, recordId);
            ps.setString(2, op);
            ps.setString(3, JsonUtil.toJsonColumn(payload));
            ps.executeUpdate();
        } catch (Exception e) {
            System.err.println("[sync_log] 写入失败: " + e.getMessage());
        }
    }

    /** 供外部以数组形式获取全部记录 */
    public static JSONArray findAllAsArray(Connection conn) throws SQLException {
        JSONArray arr = new JSONArray();
        for (JSONObject r : findAll(conn)) {
            arr.put(r);
        }
        return arr;
    }
}
