@echo off
setlocal EnableExtensions DisableDelayedExpansion

echo ===================================================
echo     Quartzy (Bio-Inventory) Local Full-Stack Starter
echo ===================================================
echo.
echo Make sure Python, Node.js, and PostgreSQL are installed.
echo If Windows Firewall prompts for access, allow it.
echo.

set "WAIT_SECONDS=2"
set "ROOT_DIR=%~dp0"
set "ENV_FILE=%ROOT_DIR%.env.local"
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=3000"
set "BACKEND_HEALTH_URL=http://localhost:%BACKEND_PORT%/health/"
set "BACKEND_READY_URL=http://localhost:%BACKEND_PORT%/ready/"
set "FRONTEND_URL=http://localhost:%FRONTEND_PORT%/"
set "BACKEND_START_TIMEOUT=120"
set "BACKEND_HEALTH_TIMEOUT=60"
set "FRONTEND_START_TIMEOUT=90"
set "BACKEND_READY=1"

if not exist "%ENV_FILE%" (
    echo [ERROR] Missing config file: %ENV_FILE%
    echo Copy .env.local.example to .env.local and fill DB credentials.
    pause
    exit /b 1
)

call :load_env "%ENV_FILE%"

if "%DEBUG%"=="" set "DEBUG=True"
if "%USE_POSTGRES%"=="" set "USE_POSTGRES=True"
if "%ALLOWED_HOSTS%"=="" set "ALLOWED_HOSTS=localhost,127.0.0.1,*"
if "%REACT_APP_API_BASE_URL%"=="" set "REACT_APP_API_BASE_URL=http://localhost:8000"

if /I "%USE_POSTGRES%"=="True" (
    call :require_env DB_HOST || goto :config_error
    call :require_env DB_PORT || goto :config_error
    call :require_env DB_NAME || goto :config_error
    call :require_env DB_USER || goto :config_error
    call :require_env DB_PASS || goto :config_error
)

echo [0/6] Preflight port check...
call :warn_if_port_in_use "%BACKEND_PORT%" "Backend API"
call :warn_if_port_in_use "%FRONTEND_PORT%" "Frontend static server"
echo [OK] Preflight check finished.
echo.

echo [1/6] Starting DYMO print agent...
start "DYMO Print Server" cmd /c "cd /d %ROOT_DIR%dymo-print-server-nodejs && python src/production_print_agent.py"
timeout /t %WAIT_SECONDS% >nul

echo [2/6] Starting Django backend API...
start "Django Backend Server" cmd /c "cd /d %ROOT_DIR%bio-inventory-backend && python -m pip install -r requirements.txt && python check_postgres_connection.py && python manage.py migrate && python manage.py runserver 0.0.0.0:8000 || (echo. && echo [ERROR] Backend startup failed. Check logs above. && pause)"
timeout /t %WAIT_SECONDS% >nul

echo [3/6] Waiting for backend port %BACKEND_PORT%...
call :wait_for_port "%BACKEND_PORT%" %BACKEND_START_TIMEOUT%
if errorlevel 1 (
    echo [WARN] Backend port %BACKEND_PORT% did not become ready in time.
    echo        Frontend will still be started so you can verify UI and logs.
    set "BACKEND_READY=0"
)

echo [4/6] Checking backend health endpoints...
if "%BACKEND_READY%"=="1" (
    call :wait_for_http "%BACKEND_HEALTH_URL%" %BACKEND_HEALTH_TIMEOUT%
    if errorlevel 1 (
        echo [WARN] Backend health check failed: %BACKEND_HEALTH_URL%
        set "BACKEND_READY=0"
    ) else (
        call :wait_for_http "%BACKEND_READY_URL%" 30 >nul 2>&1
        if errorlevel 1 (
            echo [WARN] Readiness endpoint check timed out: %BACKEND_READY_URL%
            echo       Backend may still be starting background tasks.
        ) else (
            echo [OK] HTTP check passed: %BACKEND_READY_URL%
        )
    )
) else (
    echo [WARN] Skipping backend health checks because backend did not open port.
)

echo [5/6] Deploying and starting React frontend static server...
call "%ROOT_DIR%deploy_local_frontend.bat"
if errorlevel 1 goto :frontend_start_error

echo [6/6] Verifying frontend endpoint...
call :wait_for_port "%FRONTEND_PORT%" %FRONTEND_START_TIMEOUT% || goto :frontend_start_error
call :wait_for_http "%FRONTEND_URL%" %FRONTEND_START_TIMEOUT% || goto :frontend_start_error

echo.
echo ===================================================
if "%BACKEND_READY%"=="1" (
echo Local services started and validated.
) else (
echo Frontend started, but backend is not healthy.
echo Check "Django Backend Server" window for migration/runtime errors.
)
echo [Backend API]   http://localhost:%BACKEND_PORT%
echo [Frontend UI]   http://localhost:%FRONTEND_PORT% (production static bundle)
echo [DYMO Agent]    Running in background window (manual verification if needed)
echo ===================================================

pause
exit /b 0

:backend_start_error
echo.
echo [ERROR] Backend port %BACKEND_PORT% did not become ready in time.
echo         Check "Django Backend Server" window for traceback details.
pause
exit /b 1

:backend_health_error
echo.
echo [ERROR] Backend health check failed: %BACKEND_HEALTH_URL%
echo         The backend process may be running but not healthy (DB/migration/config).
pause
exit /b 1

:frontend_start_error
echo.
echo [ERROR] Frontend deployment or health check failed.
echo         Check "Quartzy Frontend Static Server" window and deploy logs above.
pause
exit /b 1

:config_error
echo.
echo [ERROR] Incomplete database variables in .env.local. Startup stopped.
pause
exit /b 1

:require_env
set "VAR_NAME=%~1"
call set "VAR_VALUE=%%%VAR_NAME%%%"
if "%VAR_VALUE%"=="" (
    echo [ERROR] Missing environment variable: %VAR_NAME%
    exit /b 1
)
exit /b 0

:load_env
set "ENV_TARGET=%~1"
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENV_TARGET%") do (
    if not "%%~A"=="" set "%%~A=%%~B"
)
exit /b 0

:warn_if_port_in_use
set "TARGET_PORT=%~1"
set "TARGET_NAME=%~2"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%TARGET_PORT% .*LISTENING"') do (
    echo [WARN] %TARGET_NAME% target port %TARGET_PORT% is already in use by PID %%P.
    echo        Existing process may be reused; continue with caution.
    exit /b 0
)
exit /b 0

:wait_for_port
set "TARGET_PORT=%~1"
set /a PORT_TIMEOUT_SEC=%~2
set /a PORT_ELAPSED_SEC=0

:wait_for_port_loop
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%TARGET_PORT% .*LISTENING"') do (
    echo [OK] Port %TARGET_PORT% is listening ^(PID %%P^).
    exit /b 0
)
if %PORT_ELAPSED_SEC% GEQ %PORT_TIMEOUT_SEC% exit /b 1
timeout /t 2 >nul
set /a PORT_ELAPSED_SEC+=2
goto :wait_for_port_loop

:wait_for_http
set "TARGET_URL=%~1"
set /a HTTP_TIMEOUT_SEC=%~2
powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(%HTTP_TIMEOUT_SEC%); while((Get-Date)-lt $deadline){ try { $r=Invoke-WebRequest -Uri '%TARGET_URL%' -UseBasicParsing -TimeoutSec 5; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 400){ exit 0 } } catch {}; Start-Sleep -Seconds 2 }; exit 1"
if errorlevel 1 exit /b 1
echo [OK] HTTP check passed: %TARGET_URL%
exit /b 0
