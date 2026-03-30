@echo off
setlocal

cd /d "%~dp0\..\.."

echo [GitRadar] Docker 服务窗口已打开。
echo [GitRadar] 当前执行：docker compose up --build
echo [GitRadar] 如果首次启动较慢，请等待镜像构建完成。
echo [GitRadar] 如启动失败，可在本窗口直接查看错误信息。
echo.
docker compose up --build

echo.
echo [GitRadar] Docker 服务已退出。
echo [GitRadar] 如果这是异常退出，可向上翻日志查找 ERROR / failed / EADDRINUSE。
pause
