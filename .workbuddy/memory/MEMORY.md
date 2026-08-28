# 童心日记 — 项目长期记忆

## 项目概况
儿童日常活动记录网站（前端原生 JS + localStorage），已改造为前后端分离：
- 前端：`index.html` + `js/app.js`（UI）、`js/storage.js`（本地双写）、`js/database.js`（API 同步队列）、`js/export.js`（导出）。
- 后端：`backend/`（Java，JDK 内置 HttpServer + JDBC，无构建工具），`start.bat` 一键编译启动，端口 8080，同时托管前端静态页。
- 数据库：MySQL @ 8.156.64.159:3306，库名 feed，表 child / records / sync_log；喂奶(milkFeeds)/大小便(diaperChanges)/辅食(solidFoods)/tags/photos 存 JSON 列。
- 数据库凭据在 `backend/application.properties`（勿再放前端）；root 密码公网暴露有风险，README 已提示换专用账号。

## 约定
- API 契约以 `js/database.js` 的 DB_CONFIG / API_PATHS 为准，后端 ApiServer.java 必须保持一致。
- 前端本地优先：localStorage 双写 + 离线队列，恢复联网后自动/手动同步到数据库。
- 编译命令：`javac -encoding UTF-8 -cp "lib/*" -d classes src/com/childdiary/*.java`（在 backend/ 下执行）。

## 环境备忘
- 本机 JDK 25（无 Maven/Gradle）；Windows Git Bash 下 curl 内联中文会乱码，测试需用 UTF-8 文件体。
