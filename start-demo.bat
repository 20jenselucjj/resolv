@echo off
setlocal enabledelayedexpansion
:: ===============================================================
::  Resolv Demo Start Script
::  Sets up DB, installs deps if needed, starts both servers
::  Includes fallbacks for common failure modes
:: ===============================================================

cd /d "%~dp0"

echo.
echo =====================================================
echo   Starting Resolv Platform
echo =====================================================
echo.

:: ── Kill existing processes on ports 3001 and 3000 ──
echo   Checking for existing servers...
for %%p in (3001 3000) do (
  for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr ":%%p .*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
  )
)
echo   [OK] Ports cleared

:: ── Check PostgreSQL is running ──
echo.
echo   Checking PostgreSQL...
set PG_RUNNING=0
for /f "tokens=1" %%a in ('sc query postgresql-x64-16 2^>nul ^| findstr "RUNNING"') do set PG_RUNNING=1
for /f "tokens=1" %%a in ('sc query postgresql-x64-17 2^>nul ^| findstr "RUNNING"') do set PG_RUNNING=1
for /f "tokens=1" %%a in ('sc query postgresql-x64-15 2^>nul ^| findstr "RUNNING"') do set PG_RUNNING=1
if !PG_RUNNING! equ 0 (
  echo   [!] PostgreSQL service not detected as running.
  echo       Attempting to start it...
  sc start postgresql-x64-16 >nul 2>&1 || sc start postgresql-x64-17 >nul 2>&1 || (
    echo   [WARN] Could not auto-start PostgreSQL.
    echo          Make sure PostgreSQL is running before proceeding.
  )
)

:: ── Ensure root node_modules exist, install if missing ──
echo.
if not exist "node_modules" (
  echo   Installing root dependencies...
  call npm install --loglevel=error --no-optional 2>&1
  if !errorlevel! neq 0 (
    echo   [WARN] npm install had issues. Retrying with legacy peer deps...
    call npm install --loglevel=error --legacy-peer-deps 2>&1
    if !errorlevel! neq 0 (
      echo   [FAIL] Could not install dependencies.
      echo          Try: npm install --legacy-peer-deps
      pause
      exit /b 1
    )
  )
  echo   [OK] Dependencies installed
) else (
  echo   [OK] node_modules found
)

:: ── Ensure workspace node_modules exist ──
for %%w in (apps\api apps\web) do (
  if not exist "%%w\node_modules" (
    echo   Installing %%w dependencies...
    pushd %%w
    call npm install --loglevel=error --no-optional 2>&1
    popd
  )
)

:: ── Set up database ──
echo.
echo   Setting up database...
if exist "apps\api\src\db\run_schema.js" (
  pushd apps\api
  node src\db\run_schema.js
  if !errorlevel! neq 0 (
    echo   [WARN] Schema script exited with error. DB may already exist.
  ) else (
    echo   [OK] Schema
  )
  node src\db\run_seed.js
  if !errorlevel! neq 0 (
    echo   [WARN] Seed may already exist (OK if re-running)
  ) else (
    echo   [OK] Seed data
  )
  node src\db\run_migration.js
  if !errorlevel! neq 0 (
    echo   [WARN] Migrations had issues
  ) else (
    echo   [OK] Migrations
  )
  popd
) else (
  echo   [WARN] DB scripts not found at apps\api\src\db
  echo          Skipping DB setup. Run deploy-demo first.
)

:: ── Start servers ──
echo.
echo   Starting servers...
echo.

:: Try npm run dev first (uses concurrently)
echo   Running: npm run dev
start "Resolv Dev" cmd /c "npm run dev"

:: Wait for servers to start
echo   Waiting for servers to come online...
set API_READY=0
for /l %%i in (1,1,30) do (
  >nul timeout /t 1 /nobreak
  for /f %%a in ('>nul 2^>^&1 curl -s http://localhost:3001/api/health ^| findstr "api"') do set API_READY=1
  if !API_READY! equ 1 (
    echo   [OK] API server ready
    goto :web_check
  )
)
echo   [WARN] API server not responding after 30s — still starting in background
:web_check

:: Final status
echo.
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
echo   Press Enter to stop both servers...
echo =====================================================
pause >nul

:: ── Stop servers ──
echo   Stopping servers...
for %%p in (3001 3000) do (
  for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr ":%%p .*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
  )
)
echo   Servers stopped.
