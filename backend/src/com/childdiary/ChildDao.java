package com.childdiary;

import org.json.JSONObject;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * 孩子档案 DAO（单宝贝模式，行 id 固定为 1）。
 */
public final class ChildDao {

    private ChildDao() {
    }

    /** upsert 档案，返回落库后的完整对象 */
    public static JSONObject upsert(Connection conn, JSONObject c) throws SQLException {
        if (c == null || c.isEmpty()) {
            return get(conn);
        }
        String name = c.optString("name", "");
        String gender = c.optString("gender", "other");
        if (gender == null || gender.isBlank()) {
            gender = "other";
        }
        java.sql.Date birthday = JsonUtil.toDate(c.opt("birthday"), null);
        String avatar = c.optString("avatar", "👶");
        if (avatar == null || avatar.isBlank()) {
            avatar = "👶";
        }

        String sql = """
                INSERT INTO child (id, name, gender, birthday, avatar)
                VALUES (1, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE name = VALUES(name), gender = VALUES(gender),
                    birthday = VALUES(birthday), avatar = VALUES(avatar)
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, name);
            ps.setString(2, gender);
            ps.setDate(3, birthday);
            ps.setString(4, avatar);
            ps.executeUpdate();
        }
        return get(conn);
    }

    /** 读取档案，不存在返回 null */
    public static JSONObject get(Connection conn) throws SQLException {
        String sql = "SELECT name, gender, birthday, avatar, created_at, updated_at FROM child WHERE id = 1";
        try (PreparedStatement ps = conn.prepareStatement(sql); ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                return null;
            }
            JSONObject c = new JSONObject();
            c.put("name", rs.getString("name"));
            c.put("gender", rs.getString("gender"));
            java.sql.Date bd = rs.getDate("birthday");
            c.put("birthday", bd == null ? JSONObject.NULL : bd.toString());
            c.put("avatar", rs.getString("avatar"));
            c.put("createdAt", JsonUtil.toIsoString(rs.getTimestamp("created_at")));
            c.put("updatedAt", JsonUtil.toIsoString(rs.getTimestamp("updated_at")));
            return c;
        }
    }
}
