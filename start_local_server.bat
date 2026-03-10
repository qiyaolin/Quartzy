@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
set "MANAGER_SCRIPT=%ROOT_DIR%scripts\local-server-manager.ps1"

if not exist "%MANAGER_SCRIPT%" (
    echo [ERROR] Missing startup manager script: %MANAGER_SCRIPT%
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%MANAGER_SCRIPT%" -Action start-stack
set "EXIT_CODE=%ERRORLEVEL%"

echo.
pause
exit /b %EXIT_CODE%
