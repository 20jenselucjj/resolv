@echo off
:: ===============================================================
::  Resolv Demo Deployment Launcher
::  Auto-elevates to Administrator, bypasses execution policy
::  Falls back to direct PowerShell if elevation fails
:: ===============================================================
setlocal enabledelayedexpansion

cd /d "%~dp0"

:: Check if running as Administrator
net session >nul 2>&1
if !errorlevel! neq 0 (
  echo.
  echo   Requesting Administrator privileges...
  echo   (A UAC prompt may appear — click Yes)
  echo.
  powershell -NoProfile -Command ^
    "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0deploy-demo.ps1\"' -Verb RunAs"
  if !errorlevel! equ 0 (
    echo   Launched deployment script as Administrator.
	echo   The new window will run the setup automatically.
  ) else (
    echo   [!] Could not auto-elevate.
	echo   Please run this file as Administrator manually:
	echo     1. Right-click deploy-demo.bat
	echo     2. Select "Run as administrator"
	echo.
	pause
  )
  exit /b
)

:: Running as admin — execute the PowerShell script
echo.
echo   Running deployment script...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-demo.ps1"

if !errorlevel! neq 0 (
  echo.
  echo   [!] Deployment encountered errors. Check the output above.
) else (
  echo.
  echo   [OK] Deployment complete!
)
echo.
pause
