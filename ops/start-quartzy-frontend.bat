@echo off
setlocal EnableExtensions
set "ROOT_DIR=%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%\scripts\local-server-manager.ps1" -Action start-frontend
exit /b %ERRORLEVEL%
