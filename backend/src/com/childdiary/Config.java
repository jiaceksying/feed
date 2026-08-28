package com.childdiary;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Properties;

/**
 * 配置加载：读取 backend/application.properties，
 * 未配置项使用默认值。
 */
public final class Config {

    private final Properties props = new Properties();

    private Config() {
    }

    public static Config load(String[] args) {
        Config cfg = new Config();
        // 1) 默认加载后端目录下的 application.properties
        Path file = Paths.get(System.getProperty("app.dir", ".")).resolve("application.properties");
        if (Files.exists(file)) {
            try (InputStream in = Files.newInputStream(file)) {
                cfg.props.load(in);
            } catch (IOException e) {
                System.err.println("[Config] 读取配置失败: " + e.getMessage());
            }
        }
        // 2) 命令行覆盖：--key=value
        for (String arg : args) {
            if (arg.startsWith("--") && arg.contains("=")) {
                int eq = arg.indexOf('=');
                cfg.props.setProperty(arg.substring(2, eq), arg.substring(eq + 1));
            }
        }
        return cfg;
    }

    private String get(String key, String def) {
        String v = props.getProperty(key);
        return (v == null || v.isBlank()) ? def : v.trim();
    }

    /* ===== 服务 ===== */
    public String host()          { return get("server.host", "0.0.0.0"); }
    public int port()             { return Integer.parseInt(get("server.port", "8080")); }
    /** 前端静态资源目录（默认为 backend 的上级目录，即项目根） */
    public String frontendDir()   { return get("frontend.dir", ".."); }

    /* ===== 数据库 ===== */
    public String dbHost()        { return get("db.host", "127.0.0.1"); }
    public int dbPort()           { return Integer.parseInt(get("db.port", "3306")); }
    public String dbName()        { return get("db.name", "feed"); }
    public String dbUser()        { return get("db.user", "root"); }
    public String dbPassword()    { return get("db.password", ""); }
}
