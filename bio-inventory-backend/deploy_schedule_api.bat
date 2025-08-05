@echo off
echo ========================================
echo Deploying Schedule Management API Fix
echo ========================================

echo.
echo [1/3] Checking Google Cloud SDK...
where gcloud >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Google Cloud SDK not found. Please install gcloud CLI first.
    pause
    exit /b 1
)

echo.
echo [2/3] Setting up Google Cloud project...
gcloud config set project lab-inventory-467021

echo.
echo [3/3] Deploying to App Engine...
echo This will deploy the updated schedule management API endpoints.
echo.
pause

gcloud app deploy app.yaml --quiet --version=schedule-api-fix

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo SUCCESS: Schedule API deployed!
    echo ========================================
    echo.
    echo The following endpoints are now available:
    echo - https://lab-inventory-467021.nn.r.appspot.com/api/schedules/
    echo - https://lab-inventory-467021.nn.r.appspot.com/api/group-meetings/
    echo - https://lab-inventory-467021.nn.r.appspot.com/api/users/active/
    echo - https://lab-inventory-467021.nn.r.appspot.com/api/notifications/summary/
    echo - https://lab-inventory-467021.nn.r.appspot.com/schedule/equipment/
    echo.
    echo Test the frontend at: https://lab-inventory-467021.web.app
    echo.
) else (
    echo.
    echo ========================================
    echo ERROR: Deployment failed!
    echo ========================================
    echo Please check the error messages above.
    echo.
)

pause