@echo off
:: ===============================================================
::  Resolv Demo Deployment Launcher
::  Auto-elevates to Administrator, bypasses execution policy
::  Stays open on completion so you can read the output
:: ===============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

net session >nul 2>&1
if !errorlevel! neq 0 (
  echo.
  echo   Requesting Administrator privileges...
  echo   (A UAC prompt may appear — click Yes)
  echo.
  echo   The deployment will run in a new window.
  echo   Come back here and press any key when it finishes.
  echo.
  powershell -NoProfile -Command ^
    "Start-Process powershell -ArgumentList '-NoExit -NoProfile -ExecutionPolicy Bypass -File \"%~dp0deploy-demo.ps1\"' -Verb RunAs"
  echo.
  echo   If the new window appears, let it finish, then close it.
  echo.
  pause
  exit /b
)

echo.
echo   Running deployment script...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-demo.ps1"
set EXIT_CODE=!errorlevel!

echo.
if !EXIT_CODE! neq 0 (
  echo   [!] Deployment encountered errors (exit code %EXIT_CODE%).
  echo       Scroll up and check for any red/warning messages.
) else (
  echo   [OK] Deployment completed successfully!
)
echo.
pause
