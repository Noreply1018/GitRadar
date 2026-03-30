@echo off
setlocal

cd /d "%~dp0\..\.."

echo [GitRadar] 正在启动 Docker 服务...
docker compose up --build

echo.
echo [GitRadar] Docker 服务已退出。
pause
