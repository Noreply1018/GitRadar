@echo off
setlocal ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION

cd /d "%~dp0"

set "APP_URL=http://127.0.0.1:3210"
set "WAIT_SECONDS=600"
set /a "MAX_RETRIES=%WAIT_SECONDS%/2"

echo.
echo ============================================
echo   GitRadar Windows 启动器
echo   Docker 容器 + 中文网页控制台
echo ============================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  call :print_docker_missing
  goto fail
)

docker compose version >nul 2>nul
if errorlevel 1 (
  call :print_compose_missing
  goto fail
)

docker info >nul 2>nul
if errorlevel 1 (
  call :print_docker_not_started
  goto fail
)

if not exist ".env" (
  call :print_env_missing
  goto fail
)

set "ALREADY_RUNNING="
for /f "delims=" %%i in ('docker compose ps --status running --services 2^>nul') do (
  if /I "%%i"=="gitradar" set "ALREADY_RUNNING=1"
)

if defined ALREADY_RUNNING (
  echo [GitRadar] 检测到 gitradar 容器已经在运行。
  echo [GitRadar] 将直接打开控制台：%APP_URL%
  start "" "%APP_URL%"
  exit /b 0
)

echo [GitRadar] 已完成基础依赖检查。
echo [GitRadar] 正在打开服务窗口并执行 docker compose up --build ...
echo [GitRadar] 首次启动可能需要几分钟，请不要关闭新打开的服务窗口。
start "GitRadar Service" cmd /k call "%~dp0scripts\windows\run-gitradar-compose.bat"

echo [GitRadar] 正在等待控制台就绪...
echo [GitRadar] 目标地址：%APP_URL%
echo [GitRadar] 最长等待时间：%WAIT_SECONDS% 秒
set /a RETRY_COUNT=0

:wait_loop
set /a RETRY_COUNT+=1
echo [GitRadar] 健康检查第 !RETRY_COUNT!/%MAX_RETRIES% 次...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { Invoke-WebRequest -UseBasicParsing '%APP_URL%/api/health' ^| Out-Null; exit 0 } catch { exit 1 }"

if not errorlevel 1 goto open_browser

if %RETRY_COUNT% GEQ %MAX_RETRIES% goto timeout

timeout /t 2 /nobreak >nul
goto wait_loop

:open_browser
echo [GitRadar] 控制台已就绪，正在打开浏览器...
start "" "%APP_URL%"
echo [GitRadar] 已打开 %APP_URL%
echo [GitRadar] 后续如果要停止服务，请双击 stop-gitradar.bat
exit /b 0

:timeout
call :print_timeout_help
goto fail

:print_docker_missing
echo [GitRadar] 未检测到 docker 命令。
echo.
echo 常见原因：
echo   1. Docker Desktop 尚未安装
echo   2. Docker Desktop 已安装，但当前终端还没有刷新 PATH
echo.
echo 建议处理：
echo   - 先安装 Docker Desktop
echo   - 安装后重新打开资源管理器或重新登录 Windows
echo   - 再次双击 start-gitradar.bat
exit /b 0

:print_compose_missing
echo [GitRadar] 当前 Docker 不支持 docker compose。
echo.
echo 常见原因：
echo   1. Docker Desktop 版本过旧
echo   2. docker compose 插件未正确安装
echo.
echo 建议处理：
echo   - 升级 Docker Desktop 到较新版本
echo   - 在 PowerShell 里运行 docker compose version 确认可用
exit /b 0

:print_docker_not_started
echo [GitRadar] Docker Desktop 似乎还没有启动。
echo.
echo 建议处理：
echo   - 先手动打开 Docker Desktop
echo   - 等待它显示 Engine running
echo   - 再次双击 start-gitradar.bat
exit /b 0

:print_env_missing
echo [GitRadar] 未找到 .env 文件。
echo.
echo 建议处理：
echo   1. 复制 .env.example 为 .env
echo   2. 填入 GITHUB_TOKEN、GR_API_KEY、GR_BASE_URL、GR_MODEL、GITRADAR_WECOM_WEBHOOK_URL
echo   3. 保存后再次双击 start-gitradar.bat
exit /b 0

:print_timeout_help
echo [GitRadar] %WAIT_SECONDS% 秒内未检测到控制台就绪。
echo.
echo 请先查看新打开的 "GitRadar Service" 窗口日志，常见原因有：
echo   1. Docker 首次 build 镜像仍在进行
echo   2. .env 中缺少必填配置或格式错误
echo   3. 3210 端口已被其他程序占用
echo   4. Docker Desktop 网络或镜像拉取失败
echo.
echo 建议排查顺序：
echo   - 在服务窗口里查找 ERROR、failed、EADDRINUSE、Missing 等关键词
echo   - 手动运行 docker compose ps 确认容器状态
echo   - 手动运行 docker compose logs --tail=100 查看最近日志
echo   - 确认浏览器能否访问 %APP_URL%/api/health
echo.
echo 如果你已经修复问题，可以重新双击 start-gitradar.bat 重试。
exit /b 0

:fail
echo.
echo [GitRadar] 启动未完成。
pause
exit /b 1
