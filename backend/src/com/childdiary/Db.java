package com.childdiary;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * 数据库连接与初始化（MySQL 5.7+ / 8.0）。
 *
 * 启动时自动：
 *   1. 创建数据库（若不存在）；
 *   2. 建 child / records / sync_log 三张表（若不存在）。
 *
 * 表结构与 database/schema.sql 保持一致。
 */
public final class Db {

    private static String url;
    private static String user;
    private static String password;

    private Db() {
    }

    public static void init(Config cfg) throws Exception {
        Class.forName("com.mysql.cj.jdbc.Driver");

        String extra = "?useSSL=false&allowPublicKeyRetrieval=true"
                + "&characterEncoding=utf8&serverTimezone=Asia/Shanghai"
                + "&connectTimeout=8000&socketTimeout=60000";
        String serverUrl = "jdbc:mysql://" + cfg.dbHost() + ":" + cfg.dbPort() + "/" + extra;
        url = "jdbc:mysql://" + cfg.dbHost() + ":" + cfg.dbPort() + "/" + cfg.dbName() + extra;
        user = cfg.dbUser();
        password = cfg.dbPassword();

        // 1) 确保数据库存在（连接服务级 URL，不带库名）
        try (Connection c = DriverManager.getConnection(serverUrl, user, password);
             Statement st = c.createStatement()) {
            st.executeUpdate("CREATE DATABASE IF NOT EXISTS `" + cfg.dbName()
                    + "` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        }

        // 2) 建表（幂等）
        try (Connection c = connect(); Statement st = c.createStatement()) {
            st.executeUpdate("""
                    CREATE TABLE IF NOT EXISTS child (
                      id          INT PRIMARY KEY AUTO_INCREMENT,
                      name        VARCHAR(50)  NOT NULL COMMENT '宝贝姓名',
                      gender      VARCHAR(10)  DEFAULT 'other' COMMENT 'girl / boy / other',
                      birthday    DATE         NULL COMMENT '出生日期',
                      avatar      VARCHAR(16)  DEFAULT '👶' COMMENT '头像 emoji',
                      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB COMMENT='孩子档案'
                    """);
            st.executeUpdate("""
                    CREATE TABLE IF NOT EXISTS records (
                      id           VARCHAR(32)  PRIMARY KEY COMMENT '记录 ID',
                      record_date  DATE         NOT NULL COMMENT '记录日期',
                      mood         VARCHAR(20)  NULL COMMENT '心情 emoji',
                      height       DECIMAL(5,1) NULL COMMENT '身高 cm',
                      weight       DECIMAL(5,2) NULL COMMENT '体重 kg',
                      sleep_hours  DECIMAL(4,1) NULL COMMENT '睡眠时长 h',
                      tags         JSON         NULL COMMENT '标签数组',
                      activities   TEXT         NULL COMMENT '活动描述',
                      breakfast    TEXT         NULL COMMENT '早餐',
                      lunch        TEXT         NULL COMMENT '午餐',
                      dinner       TEXT         NULL COMMENT '晚餐',
                      snacks       TEXT         NULL COMMENT '零食/加餐',
                      milestones   TEXT         NULL COMMENT '里程碑与趣事',
                      notes        TEXT         NULL COMMENT '备注',
                      milk_feeds       JSON NULL COMMENT '喂奶明细',
                      diaper_changes   JSON NULL COMMENT '大小便明细',
                      solid_foods      JSON NULL COMMENT '辅食明细',
                      photos       JSON         NULL COMMENT '照片数组',
                      created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                      KEY idx_record_date (record_date),
                      KEY idx_updated_at (updated_at)
                    ) ENGINE=InnoDB COMMENT='儿童日常记录'
                    """);
            st.executeUpdate("""
                    CREATE TABLE IF NOT EXISTS sync_log (
                      id          BIGINT PRIMARY KEY AUTO_INCREMENT,
                      record_id   VARCHAR(32)  NULL,
                      op          VARCHAR(20)  NOT NULL,
                      payload     JSON         NULL,
                      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      KEY idx_record (record_id)
                    ) ENGINE=InnoDB COMMENT='同步日志'
                    """);
        }
    }

    /** 每次请求建立新连接（家庭应用规模足够，且天然避免连接失效问题） */
    public static Connection connect() throws SQLException {
        return DriverManager.getConnection(url, user, password);
    }
}
