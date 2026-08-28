package com.childdiary;

import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 童心日记 — Java 后端入口。
 *
 * 启动流程：初始化日志（控制台 + logs/server.log 双写）→ 加载配置
 *          → 初始化数据库（建库/建表）→ 启动 HTTP 服务（API + 前端静态托管）。
 *
 * 支持后台运行（start.bat 使用 javaw 无窗口启动，日志见 backend/logs/server.log）。
 */
public final class Main {

    public static void main(String[] args) {
        initLogging();
        try {
            Config cfg = Config.load(args);

            System.out.println("=====================================================");
            System.out.println("[" + now() + "] 正在连接数据库 "
                    + cfg.dbHost() + ":" + cfg.dbPort() + "/" + cfg.dbName() + " ...");
            Db.init(cfg);
            System.out.println("[" + now() + "] 数据库初始化完成（库表已就绪）");

            new ApiServer(cfg).start();
            System.out.println("[" + now() + "] 服务已就绪，等待请求...");
        } catch (Exception e) {
            System.err.println("[" + now() + "] 启动失败: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static String now() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    /**
     * 控制台 + logs/server.log 双写。
     * 这样即使以 javaw 后台方式启动（无控制台），日志也能落盘，便于排查。
     */
    private static void initLogging() {
        try {
            Path logDir = Paths.get(System.getProperty("user.dir"), "logs");
            Files.createDirectories(logDir);
            FileOutputStream fileOut = new FileOutputStream(logDir.resolve("server.log").toFile(), true);

            PrintStream out = System.out;
            PrintStream err = System.err;
            PrintStream file = new PrintStream(fileOut, true, StandardCharsets.UTF_8);

            System.setOut(new PrintStream(new OutputStream() {
                @Override public void write(int b) throws IOException { out.write(b); file.write(b); }
                @Override public void flush() throws IOException { out.flush(); file.flush(); }
            }, true, StandardCharsets.UTF_8));
            System.setErr(new PrintStream(new OutputStream() {
                @Override public void write(int b) throws IOException { err.write(b); file.write(b); }
                @Override public void flush() throws IOException { err.flush(); file.flush(); }
            }, true, StandardCharsets.UTF_8));

            System.out.println();
            System.out.println("───────────── 服务启动 " + now() + " ─────────────");
        } catch (Exception e) {
            // 日志初始化失败不影响启动，仅提示
            System.err.println("[警告] 无法初始化日志文件: " + e.getMessage());
        }
    }
}
