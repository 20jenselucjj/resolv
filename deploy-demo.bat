@echo off
:: ===============================================================
::  Resolv Demo Deployment Launcher
::  Auto-elevates to Administrator and runs deploy-demo.ps1
:: ===============================================================

setlocal enabledelayedexpansion

:: Check if running as Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo   Requesting Administrator privileges...
  powershell -Command "Start-Process '%~dp0deploy-demo.ps1' -Verb RunAs"
  exit /b
)

:: Running as admin - execute the PowerShell script
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-demo.ps1"
pause
