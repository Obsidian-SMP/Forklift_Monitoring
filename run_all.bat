@echo off
REM Warehouse IoT - Unified Backend & Frontend Launcher (Windows)
REM Runs both Flask backend and React frontend with proper logging

setlocal enabledelayedexpansion
cd /d "%~dp0"

set "SCRIPT_DIR=%cd%"
set "BACKEND_DIR=%SCRIPT_DIR%\backend"
set "FRONTEND_DIR=%SCRIPT_DIR%\frontend"
set "LOG_DIR=%SCRIPT_DIR%\logs"
set "BACKEND_LOG=%LOG_DIR%\backend.log"
set "FRONTEND_LOG=%LOG_DIR%\frontend.log"
set "COMBINED_LOG=%LOG_DIR%\combined.log"

set "BACKEND_PORT=5000"
set "FRONTEND_PORT=5173"
set "BACKEND_HOST=0.0.0.0"

set "BACKEND_PID_FILE=%SCRIPT_DIR%\.backend.pid"
set "FRONTEND_PID_FILE=%SCRIPT_DIR%\.frontend.pid"

if "%1"=="" set "COMMAND=start"
if "%1"=="start" set "COMMAND=start"
if "%1"=="stop" set "COMMAND=stop"
if "%1"=="status" set "COMMAND=status"
if "%1"=="logs" set "COMMAND=logs"
if "%1"=="clean" set "COMMAND=clean"
if "%1"=="help" set "COMMAND=help"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:execute_command
if "%COMMAND%"=="start" goto start_services
if "%COMMAND%"=="stop" goto stop_services
if "%COMMAND%"=="status" goto show_status
if "%COMMAND%"=="logs" goto show_logs
if "%COMMAND%"=="clean" goto clean_files
if "%COMMAND%"=="help" goto show_help
goto show_help

:start_services
cls
echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║  🏭 Warehouse IoT System - Starting Services         ║
echo ╚════════════════════════════════════════════════════════╝
echo.

echo [INFO] Checking directories...
if not exist "%BACKEND_DIR%" (
    echo [ERROR] Backend directory not found: %BACKEND_DIR%
    exit /b 1
)
if not exist "%FRONTEND_DIR%" (
    echo [ERROR] Frontend directory not found: %FRONTEND_DIR%
    exit /b 1
)
echo [✓] Directories found

echo.
echo [INFO] Starting Flask backend...
start "Warehouse-Backend" cmd /k "cd /d %BACKEND_DIR% && python -m venv venv 2>nul & call venv\Scripts\activate.bat 2>nul & pip install -q -r requirements.txt 2>nul & set FLASK_APP=run.py & set FLASK_ENV=production & python run.py >> %BACKEND_LOG% 2>&1"

timeout /t 3 /nobreak

echo [INFO] Starting React frontend...
cd /d "%FRONTEND_DIR%"

if not exist "node_modules" (
    echo [INFO] Installing frontend dependencies...
    call npm install --silent
)

if not exist ".env.local" (
    echo [INFO] Creating .env.local...
    (
        echo VITE_API_URL=http://localhost:%BACKEND_PORT%/api
        echo VITE_WS_URL=ws://localhost:%BACKEND_PORT%
    ) > .env.local
)

start "Warehouse-Frontend" cmd /k "cd /d %FRONTEND_DIR% & npm run dev -- --host 0.0.0.0 --port %FRONTEND_PORT%"

timeout /t 3 /nobreak

cls
echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║  ✓ Services Started Successfully                      ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo 🔗 Access Points:
echo   Web UI:        http://localhost:%FRONTEND_PORT%
echo   Backend API:   http://localhost:%BACKEND_PORT%/api
echo.
echo 📝 Logs:
echo   Backend:       %BACKEND_LOG%
echo   Frontend:      %FRONTEND_LOG%
echo.
echo [INFO] Services running in separate windows
echo [INFO] Close the windows to stop services
pause
exit /b 0

:stop_services
echo [INFO] Stopping services...
taskkill /FI "WINDOWTITLE eq Warehouse-Backend" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Warehouse-Frontend" /T /F >nul 2>&1
echo [✓] Services stopped
exit /b 0

:show_status
echo.
echo ═══════════════════════════════════════════════════════
echo 📊 Service Status
echo ═══════════════════════════════════════════════════════
echo.
tasklist | find "python.exe" >nul && (
    echo Backend (port %BACKEND_PORT%):    ✓ Running
) || (
    echo Backend (port %BACKEND_PORT%):    ✗ Stopped
)

tasklist | find "node.exe" >nul && (
    echo Frontend (port %FRONTEND_PORT%):   ✓ Running
) || (
    echo Frontend (port %FRONTEND_PORT%):   ✗ Stopped
)

echo.
echo 🔗 Access Points:
echo   Web UI:        http://localhost:%FRONTEND_PORT%
echo   Backend API:   http://localhost:%BACKEND_PORT%/api
echo.
echo ═══════════════════════════════════════════════════════
echo.
pause
exit /b 0

:show_logs
if exist "%COMBINED_LOG%" (
    type "%COMBINED_LOG%"
) else (
    echo [ERROR] No logs found
)
pause
exit /b 0

:clean_files
echo [INFO] Cleaning up logs and temp files...
if exist "%LOG_DIR%" rmdir /s /q "%LOG_DIR%"
del /q "%BACKEND_PID_FILE%" >nul 2>&1
del /q "%FRONTEND_PID_FILE%" >nul 2>&1
echo [✓] Cleanup complete
exit /b 0

:show_help
cls
echo.
echo 🏭 Warehouse IoT - Unified Launcher (Windows)
echo.
echo Usage: run_all.bat [COMMAND]
echo.
echo Commands:
echo   start       Start both backend and frontend (default)
echo   stop        Stop all running services
echo   status      Show service status
echo   logs        Display combined logs
echo   clean       Remove all logs and temp files
echo   help        Show this help message
echo.
echo Examples:
echo   run_all.bat start              - Start services
echo   run_all.bat stop               - Stop services
echo   run_all.bat status             - Check status
echo.
echo 🚀 Quick Start:
echo   1. run_all.bat start
echo   2. Visit http://localhost:5173 in your browser
echo   3. Backend API available at http://localhost:5000/api
echo.
pause
exit /b 0
