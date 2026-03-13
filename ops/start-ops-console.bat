@echo off
setlocal EnableExtensions
set "ROOT_DIR=%~dp0.."
set "LOG_FILE=%ROOT_DIR%\logs\ops-console.log"
if not exist "%ROOT_DIR%\logs" mkdir "%ROOT_DIR%\logs"
echo ==================================================>> "%LOG_FILE%"
echo [%DATE% %TIME%] Starting Quartzy Ops Console>> "%LOG_FILE%"
echo ==================================================>> "%LOG_FILE%"
python "%ROOT_DIR%\ops-console\server\app.py" >> "%LOG_FILE%" 2>&1
exit /b %ERRORLEVEL%
