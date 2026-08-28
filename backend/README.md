# 童心日记 — Java 后端

将原有纯前端（localStorage）项目改造为前后端分离架构：前端页面不变，数据通过 HTTP API 存入 MySQL 数据库。

## 技术选型

| 组件 | 选择 | 说明 |
|------|------|------|
| 运行时 | JDK 17+（本机为 JDK 25） | 无需 Maven/Gradle，`javac` 直接编译 |
| HTTP 服务 | JDK 内置 `com.sun.net.httpserver` | 零框架依赖，轻量稳定 |
| JSON 处理 | org.json（lib/json-20240303.jar） | 解析与序列化 |
| 数据库 | MySQL 5.7+ / 8.0（lib/mysql-connector-j-8.4.0.jar） | 库表结构与 `database/schema.sql` 一致 |

## 目录结构

```
backend/
├── application.properties   # 配置（端口、数据库连接、前端目录）
├── start.bat / stop.bat     # Windows 一键后台启动 / 停止
├── start.sh / stop.sh       # Linux/macOS/Git Bash 后台启动 / 停止
├── lib/                     # 依赖 jar（MySQL 驱动、org.json）
├── src/com/childdiary/
│   ├── Main.java            # 入口：加载配置 → 初始化库表 → 启动服务
│   ├── Config.java          # 配置加载（properties + 命令行覆盖）
│   ├── Db.java              # 数据库连接与建库建表（幂等）
│   ├── ApiServer.java       # API 路由 + 前端静态资源托管 + CORS
│   ├── ChildDao.java        # 孩子档案 DAO
│   ├── RecordDao.java       # 日常记录 DAO（含喂奶/大小便/辅食 JSON 明细）
│   └── JsonUtil.java        # HTTP/JSON/类型转换工具
└── classes/                 # 编译输出
```

## 快速启动

```bash
# Windows：双击或运行（后台启动，无窗口）
backend\start.bat

# 停止服务
backend\stop.bat

# Linux / macOS / Git Bash
bash backend/start.sh   # 后台启动（nohup，PID 记录在 backend/backend.pid）
bash backend/stop.sh    # 停止（优先用 pidfile，兜底按端口查找）
```

启动/停止脚本会自动读取 `application.properties` 中的 `server.port`，按端口定位服务；
`start` 在服务已运行时不会重复启动，`stop` 未发现服务时也会给出提示。

启动后：
- 前端页面：<http://localhost:8080/>
- API 前缀：<http://localhost:8080/api>
- 运行日志：`backend/logs/server.log`（后台运行时排查问题看这里）

首次启动会自动在 MySQL 中建库（默认 `feed`）和 `child`、`records`、`sync_log` 三张表（`IF NOT EXISTS`，幂等安全）。

## API 契约（与前端 js/database.js 一一对应）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 探活，返回 `{status, db, time}` |
| GET | `/api/child` | 读取孩子档案 |
| PUT | `/api/child` | 保存孩子档案（body: child 对象，upsert） |
| GET | `/api/records` | 拉取全部数据 `{child, records, exportDate, version}` |
| POST | `/api/records` | 全量推送 `{child, records}`，事务性覆盖服务端 |
| PUT | `/api/records/{id}` | 新增/更新单条记录（upsert） |
| DELETE | `/api/records/{id}` | 删除单条记录 |

所有接口均开启 CORS，前端既可由本服务托管（无跨域），也可独立部署（如 `file://` 打开 index.html）。

## 配置说明（application.properties）

| 键 | 默认值 | 说明 |
|----|--------|------|
| `server.host` | 0.0.0.0 | 监听地址 |
| `server.port` | 8080 | 监听端口 |
| `frontend.dir` | `..` | 前端静态目录（相对 backend），默认托管项目根 |
| `db.host` / `db.port` | — | MySQL 地址 |
| `db.name` | feed | 库名（不存在会自动创建） |
| `db.user` / `db.password` | — | 数据库账号 |

命令行可覆盖任意配置项，如：`java -cp "classes;lib/*" com.childdiary.Main --server.port=9090`

## 数据存储映射

前端一条记录（JSON）落库为 `records` 表一行：

| 前端字段 | 数据库列 | 类型 |
|----------|----------|------|
| id | id | VARCHAR(32) 主键 |
| date | record_date | DATE |
| mood | mood | VARCHAR(20) |
| height / weight / sleepHours | height / weight / sleep_hours | DECIMAL |
| tags / photos | tags / photos | JSON |
| activities … notes | 同名列 | TEXT |
| milkFeeds（喂奶明细） | milk_feeds | JSON |
| diaperChanges（大小便明细） | diaper_changes | JSON |
| solidFoods（辅食明细） | solid_foods | JSON |
| createdAt / updatedAt | created_at / updated_at | DATETIME |

## 前端接入

`js/database.js` 中的 `DB_CONFIG.apiBaseUrl` 已指向 `http://localhost:8080/api`。
前端仍保留 localStorage 双写 + 离线同步队列：断网时操作在本地积压，恢复后自动/手动（设置页「立即同步」）写入数据库。

## 安全提示

⚠️ `application.properties` 中含数据库明文密码，仅供本机/内网使用。公网部署前请：
1. 为应用创建最小权限的专用 MySQL 账号（勿用 root）；
2. 修改密码并限制来源 IP；
3. 如需公网访问，建议前置 Nginx 反向代理并加 HTTPS 与访问鉴权。
