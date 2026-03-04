@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
set "FRONTEND_DIR=%ROOT_DIR%bio-inventory-frontend"
set "SERVE_CONFIG=%FRONTEND_DIR%\serve.json"
set "PORT=3000"

echo ===================================================
echo      Quartzy Frontend Local Deployment (Static)
echo ===================================================
echo.

if not exist "%FRONTEND_DIR%\package.json" (
  echo [ERROR] Frontend directory not found: %FRONTEND_DIR%
  exit /b 1
)

echo [1/4] Building frontend production bundle...
pushd "%FRONTEND_DIR%"
set "REACT_APP_API_BASE_URL=auto"
set "REACT_APP_API_URL=auto"
call npm run build
if errorlevel 1 (
  echo [ERROR] Frontend build failed.
  popd
  exit /b 1
)
popd

echo [2/4] Stopping existing service on port %PORT%...
set "PORT_IN_USE="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  set "PORT_IN_USE=1"
  taskkill /PID %%P /F >nul 2>&1
)
timeout /t 1 >nul

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo [ERROR] Port %PORT% is still occupied by PID %%P.
  echo         Please run this script in an elevated terminal or stop the old service manually.
  exit /b 1
)

echo [3/4] Starting static frontend server on port %PORT%...
start "Quartzy Frontend Static Server" cmd /c "cd /d %FRONTEND_DIR% && npx --yes serve -s build -l %PORT% -c ""%SERVE_CONFIG%"" --no-port-switching -n -L"

echo [4/4] Verifying local endpoint...
powershell -NoProfile -Command "for($i=0;$i -lt 20;$i++){ try { $r = Invoke-WebRequest -Uri 'http://localhost:%PORT%' -UseBasicParsing -TimeoutSec 5; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ if($r.Content -match '/static/js/main\.[^\"'']+\.js'){ exit 0 }; if($r.Content -match '/static/js/bundle\.js'){ exit 2 } } } catch {}; Start-Sleep -Seconds 2 }; exit 1"
if errorlevel 2 (
  echo [ERROR] Port %PORT% is not serving production hashed assets.
  echo         Current page still points to /static/js/bundle.js ^(dev server^).
  echo         Stop the old dev server and rerun this script.
  exit /b 1
)
if errorlevel 1 (
  echo [ERROR] Deployment verification failed. Check the "Quartzy Frontend Static Server" window logs.
  exit /b 1
)

echo.
echo [SUCCESS] Local frontend deployed.
echo URL: http://localhost:%PORT%
echo Cloudflare Tunnel (inventory.hayerlab.org) should now serve this latest build.
echo.
exit /b 0
