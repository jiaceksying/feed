@echo off
rem ============================================
rem 童心日记后端 - 启动脚本（后台运行）
rem 用法：双击或命令行执行 start.bat
rem 停止：运行 stop.bat
rem ============================================
cd /d "%~dp0"

rem ---- 读取端口（默认 8080）----
set "PORT=8080"
for /f "usebackq tokens=1,* delims==" %%A in ("application.properties") do (
  if /I "%%A"=="server.port" set "PORT=%%B"
)

rem ---- 已在运行则不重复启动 ----
netstat -ano | findstr /C:":%PORT% " | findstr /C:"LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [童心日记后端] 端口 %PORT% 已有服务在运行，如需重启请先运行 stop.bat
  exit /b 0
)

echo [童心日记后端] 编译中...
if not exist classes mkdir classes
javac -encoding UTF-8 -cp "lib/*" -d classes src\com\childdiary\*.java
if errorlevel 1 (
  echo 编译失败，请检查 JDK 是否安装
  pause
  exit /b 1
)

if not exist logs mkdir logs

rem ---- 后台启动（javaw 无窗口，日志写入 logs\server.log）----
start "" javaw -cp "classes;lib/*" com.childdiary.Main

echo [童心日记后端] 已在后台启动（无窗口）
echo   页面: http://localhost:%PORT%/
echo   API : http://localhost:%PORT%/api
echo   日志: logs\server.log
echo   停止: 运行 stop.bat
