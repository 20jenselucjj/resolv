@echo off
setlocal enabledelayedexpansion
:: ===============================================================
::  Resolv Demo Start Script
:: ===============================================================

echo.
echo =====================================================
echo   Starting Resolv Platform
echo =====================================================
echo.

:: Kill existing processes on ports 3001 and 3000
for %%p in (3001 3000) do (
  for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr ":%%p .*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
  )
)

:: Install npm deps if missing
if not exist "node_modules\.package-lock.json" (
  echo   Installing npm dependencies...
  call npm install --loglevel=error
  if !errorlevel! neq 0 (
    echo   [FAIL] npm install failed
    pause
    exit /b 1
  )
)

:: Set up database
echo.
echo   Setting up database...
pushd apps\api
node src\db\run_schema.js
if !errorlevel! neq 0 (
  echo   [WARN] Schema may already exist
)
node src\db\run_seed.js
if !errorlevel! neq 0 (
  echo   [WARN] Seed data may already exist
)
node src\db\run_migration.js
popd

echo.
echo   Starting API server on port 3001...
echo   Starting Web server on port 3000...
echo.

:: Run npm dev from repo root (concurrently runs both)
start "Resolv API + Web" cmd /c "npm run dev"

timeout /t 10 /nobreak >nul

echo =====================================================
echo   Resolv is ready!
echo.
echo   Frontend:  http://localhost:3000
echo   API:       http://localhost:3001
echo   Health:    http://localhost:3001/api/health
echo.
echo   Default login:  marcus.johnson@company.com / password
echo                   sarah.chen@company.com (admin)
echo.
echo   Press Ctrl+C in the server window, or press Enter
echo   here to stop both servers...
echo =====================================================
pause >nul

echo   Stopping servers...
for %%p in (3001 3000) do (
  for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr ":%%p .*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
  )
)
echo   Servers stopped.
