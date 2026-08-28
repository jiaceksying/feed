#!/usr/bin/env bash
# 童心日记后端停止脚本（Linux/macOS/Git Bash）
cd "$(dirname "$0")" || exit 1

# 读取端口（默认 8080）
PORT=$(grep -E '^server\.port' application.properties 2>/dev/null | cut -d= -f2 | tr -d ' \r')
PORT=${PORT:-8080}

stopped=0

# 1) 优先用 pidfile（start.sh 写入）
if [ -f backend.pid ]; then
  PID=$(cat backend.pid)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null && stopped=1 && echo "[童心日记后端] 已停止 (PID $PID)"
  fi
  rm -f backend.pid
fi

# 2) 兜底：按端口查找并终止
if [ "$stopped" -eq 0 ] && command -v netstat >/dev/null 2>&1; then
  for PID in $(netstat -ano 2>/dev/null | grep -E ":$PORT[^0-9]" | grep LISTENING | awk '{print $NF}' | sort -u); do
    if [ -n "$PID" ] && [ "$PID" != "0" ]; then
      # Git Bash 下对 Windows 原生进程使用 taskkill，Linux/macOS 用 kill
      if command -v taskkill >/dev/null 2>&1; then
        taskkill //F //PID "$PID" >/dev/null 2>&1 && stopped=1
      else
        kill "$PID" 2>/dev/null && stopped=1
      fi
      echo "[童心日记后端] 已停止端口 $PORT 上的进程 (PID $PID)"
    fi
  done
fi

if [ "$stopped" -eq 0 ]; then
  echo "[童心日记后端] 端口 $PORT 上没有发现运行中的服务"
fi
