@echo off
echo ========================================
echo DYMO Centralized Print System
echo Production Version 1.0.0
echo ========================================
echo.

echo Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.7+ and try again
    pause
    exit /b 1
)

echo Starting DYMO Print Agent...
echo Press Ctrl+C to stop the service
echo.

cd /d "%~dp0src"
python production_print_agent.py

echo.
echo Print agent stopped.
pause