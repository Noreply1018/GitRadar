@echo off
setlocal

cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
  echo [GitRadar] 未检测到 docker 命令，无法停止服务。
  pause
  exit /b 1
)

docker compose down

if errorlevel 1 (
  echo [GitRadar] 停止失败，请查看上面的 Docker 输出。
  pause
  exit /b 1
)

echo [GitRadar] Docker 服务已停止。
pause
