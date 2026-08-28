@echo off
rem ============================================
rem 童心日记后端 - 停止脚本
rem 用法：双击或命令行执行 stop.bat
rem 说明：自动读取 application.properties 中的端口，
rem       结束监听该端口的后端进程
rem ============================================
cd /d "%~dp0"

rem ---- 读取端口（默认 8080）----
set "PORT=8080"
for /f "usebackq tokens=1,* delims==" %%A in ("application.properties") do (
  if /I "%%A"=="server.port" set "PORT=%%B"
)

rem ---- 查找并终止监听该端口的进程 ----
set "KILLED="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":%PORT% " ^| findstr /C:"LISTENING"') do (
  taskkill /F /PID %%P >nul 2>&1 && set "KILLED=1"
)

if defined KILLED (
  echo [童心日记后端] 已停止端口 %PORT% 上的服务
) else (
  echo [童心日记后端] 端口 %PORT% 上没有发现运行中的服务
)
pause
