@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
set "MANAGER_SCRIPT=%ROOT_DIR%scripts\local-server-manager.ps1"

if not exist "%MANAGER_SCRIPT%" (
  echo [ERROR] Missing frontend deployment manager script: %MANAGER_SCRIPT%
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%MANAGER_SCRIPT%" -Action deploy-frontend
exit /b %ERRORLEVEL%
