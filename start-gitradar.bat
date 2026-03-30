@echo off
setlocal ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION

cd /d "%~dp0"

set "APP_URL=http://127.0.0.1:3210"
set "WAIT_SECONDS=600"
set /a "MAX_RETRIES=%WAIT_SECONDS%/2"

where docker >nul 2>nul
if errorlevel 1 (
  echo [GitRadar] 未检测到 docker 命令。请先安装并启动 Docker Desktop。
  pause
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo [GitRadar] 当前 Docker 不支持 docker compose。请升级 Docker Desktop。
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [GitRadar] Docker Desktop 似乎还没有启动。请先打开 Docker Desktop。
  pause
  exit /b 1
)

if not exist ".env" (
  echo [GitRadar] 未找到 .env。请先复制 .env.example 为 .env 并填入配置。
  pause
  exit /b 1
)

set "ALREADY_RUNNING="
for /f "delims=" %%i in ('docker compose ps --status running --services 2^>nul') do (
  if /I "%%i"=="gitradar" set "ALREADY_RUNNING=1"
)

if defined ALREADY_RUNNING (
  echo [GitRadar] 检测到服务已在运行，直接打开控制台。
  start "" "%APP_URL%"
  exit /b 0
)

echo [GitRadar] 正在打开服务窗口并启动容器...
start "GitRadar Service" cmd /k call "%~dp0scripts\windows\run-gitradar-compose.bat"

echo [GitRadar] 正在等待控制台就绪...
set /a RETRY_COUNT=0

:wait_loop
set /a RETRY_COUNT+=1
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
exit /b 0

:timeout
echo [GitRadar] %WAIT_SECONDS% 秒内未检测到控制台就绪，请查看 "GitRadar Service" 窗口日志。
pause
exit /b 1
