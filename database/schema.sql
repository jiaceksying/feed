-- ============================================================
-- 童心日记 — 数据库建表脚本（MySQL 5.7+ / 8.0）
-- 用途：配合 js/database.js 的 DB_CONFIG 预留连接使用。
-- 后续搭建后端 API 时，按此结构建表即可，字段与前端记录一一对应。
-- 兼容 PostgreSQL：将 JSON 改为 JSONB、DATETIME 改为 TIMESTAMP 即可。
-- ============================================================

CREATE DATABASE IF NOT EXISTS child_diary
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE child_diary;

-- ------------------------------------------------------------
-- 孩子档案表（单用户单宝贝，id 固定为 1；多宝贝可扩展）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS child (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(50)  NOT NULL COMMENT '宝贝姓名',
  gender      VARCHAR(10)  DEFAULT 'other' COMMENT 'girl / boy / other',
  birthday    DATE         NULL COMMENT '出生日期',
  avatar      VARCHAR(16)  DEFAULT '👶' COMMENT '头像 emoji',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='孩子档案';

-- ------------------------------------------------------------
-- 日常记录表（一天可多条；喂养/大小便/辅食明细存 JSON）
-- 与前端 Record 字段一一对应
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS records (
  id           VARCHAR(32)  PRIMARY KEY COMMENT '前端生成的记录 ID',
  record_date  DATE         NOT NULL COMMENT '记录日期',
  mood         VARCHAR(20)  NULL COMMENT '心情 emoji',

  -- 成长数据
  height       DECIMAL(5,1) NULL COMMENT '身高 cm',
  weight       DECIMAL(5,2) NULL COMMENT '体重 kg',
  sleep_hours  DECIMAL(4,1) NULL COMMENT '睡眠时长 h',

  -- 日常内容
  tags         JSON         NULL COMMENT '标签数组，如 ["户外活动","阅读"]',
  activities   TEXT         NULL COMMENT '活动描述',
  breakfast    TEXT         NULL COMMENT '早餐',
  lunch        TEXT         NULL COMMENT '午餐',
  dinner       TEXT         NULL COMMENT '晚餐',
  snacks       TEXT         NULL COMMENT '零食/加餐',
  milestones   TEXT         NULL COMMENT '里程碑与趣事',
  notes        TEXT         NULL COMMENT '备注',

  -- 专项追踪明细（与前端 milkFeeds / diaperChanges / solidFoods 对应）
  -- 奶量喂养明细：[{ time, type(母乳/配方奶/混合喂养/挤出母乳), amount_ml, duration_min, note }]
  milk_feeds       JSON NULL COMMENT '喂奶明细',
  -- 大小便明细：[{ time, type(小便/大便/大小便), consistency, color, note }]
  diaper_changes   JSON NULL COMMENT '大小便明细',
  -- 辅食明细：[{ time, food, amount(少量/半碗/一碗), reaction(喜欢/一般/拒绝/过敏), note }]
  solid_foods      JSON NULL COMMENT '辅食明细',

  -- 图片（base64 压缩图数组；生产环境建议改存对象存储并保存 URL）
  photos       JSON         NULL COMMENT '照片数组',

  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_record_date (record_date),
  KEY idx_updated_at (updated_at)
) ENGINE=InnoDB COMMENT='儿童日常记录';

-- ------------------------------------------------------------
-- 同步日志表（可选）：记录前端同步操作，便于排查
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_log (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  record_id   VARCHAR(32)  NULL COMMENT '关联记录 ID',
  op          VARCHAR(20)  NOT NULL COMMENT 'saveChild / upsertRecord / deleteRecord / replaceAll',
  payload     JSON         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_record (record_id)
) ENGINE=InnoDB COMMENT='同步日志';

-- ============================================================
-- 后端 API 约定（js/database.js 调用的端点，供实现参考）
--   GET    {apiBaseUrl}/health        探活，返回 200
--   PUT    {apiBaseUrl}/child         保存孩子档案（body: child 对象）
--   GET    {apiBaseUrl}/records       拉取全部记录
--   POST   {apiBaseUrl}/records       全量推送（body: { child, records }，覆盖服务端）
--   PUT    {apiBaseUrl}/records/:id   新增/更新单条记录（upsert）
--   DELETE {apiBaseUrl}/records/:id   删除单条记录
-- ============================================================
