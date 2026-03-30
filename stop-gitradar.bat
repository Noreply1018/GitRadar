@echo off
setlocal

cd /d "%~dp0"

echo.
echo ============================================
echo   GitRadar Windows 停止器
echo ============================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo [GitRadar] 未检测到 docker 命令，无法停止服务。
  echo [GitRadar] 请先确认 Docker Desktop 安装和 PATH 配置正常。
  pause
  exit /b 1
)

echo [GitRadar] 正在停止 Docker 服务...
docker compose down

if errorlevel 1 (
  echo [GitRadar] 停止失败，请查看上面的 Docker 输出。
  echo [GitRadar] 可尝试手动执行 docker compose ps 和 docker compose logs。
  pause
  exit /b 1
)

echo [GitRadar] Docker 服务已停止。
pause
