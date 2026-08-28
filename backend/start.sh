#!/usr/bin/env bash
# 童心日记后端启动脚本（Linux/macOS/Git Bash）— 后台运行
cd "$(dirname "$0")" || exit 1

# 读取端口（默认 8080）
PORT=$(grep -E '^server\.port' application.properties 2>/dev/null | cut -d= -f2 | tr -d ' \r')
PORT=${PORT:-8080}

# 已在运行则不重复启动
if command -v netstat >/dev/null 2>&1 && netstat -ano 2>/dev/null | grep -E ":$PORT[^0-9]" | grep -q LISTENING; then
  echo "[童心日记后端] 端口 $PORT 已有服务在运行，如需重启请先执行 stop.sh"
  exit 0
fi

echo "[童心日记后端] 编译中..."
mkdir -p classes logs
javac -encoding UTF-8 -cp "lib/*" -d classes src/com/childdiary/*.java || exit 1

# 后台启动：程序自身已将日志双写到 logs/server.log，
# 此处另存 nohup.log 以捕获启动早期（如类加载失败）的输出
nohup java -cp "classes:lib/*" com.childdiary.Main > logs/nohup.log 2>&1 &
echo $! > backend.pid

echo "[童心日记后端] 已在后台启动 (PID $(cat backend.pid))"
echo "  页面: http://localhost:$PORT/"
echo "  API : http://localhost:$PORT/api"
echo "  日志: logs/server.log"
echo "  停止: 执行 stop.sh"
