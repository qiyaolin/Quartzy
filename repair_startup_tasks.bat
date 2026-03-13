@echo off
setlocal EnableExtensions
set "ROOT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%ops\repair-startup.ps1"
pause
