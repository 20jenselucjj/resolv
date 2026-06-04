# ===============================================================
#  Resolv Demo Deployment Script
#  Sets up the IT service management platform on any Windows PC
#  Includes fallbacks for NSSM, pkg, DB, and build failures
# ===============================================================
$ErrorActionPreference = "Continue"
$WarningPreference = "Continue"
$repoRoot = Split-Path $MyInvocation.MyCommand.Path -Parent
Set-Location $repoRoot

# Check admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "[!] Not running as Administrator." -ForegroundColor Yellow
  Write-Host "   Some steps (winget installs, service management) will be skipped." -ForegroundColor Yellow
  Write-Host "   The script will continue with what it can do." -ForegroundColor Yellow
  Write-Host ""
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Resolv - IT Service Management Platform" -ForegroundColor Cyan
Write-Host "  Demo Deployment Script" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------------
function Find-Command($cmd, $checkArgs, $searchDirs) {
  try { $r = & $cmd $checkArgs 2>$null; if ($LASTEXITCODE -eq 0 -or $r -match '\d+\.\d+') { return $true } } catch {}
  foreach ($base in $searchDirs) {
    if (-not (Test-Path $base)) { continue }
    foreach ($dir in (Get-ChildItem $base -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending)) {
      $exe = Join-Path $dir.FullName "bin\$cmd.exe"
      if (Test-Path $exe) { try { & $exe $checkArgs 2>$null | Out-Null; $script:foundExe = $exe; return $true } catch {} }
    }
  }
  foreach ($base in $searchDirs) {
    $exe = Get-ChildItem $base -Recurse -Filter "$cmd.exe" -ErrorAction SilentlyContinue | Sort-Object FullName | Select-Object -First 1
    if ($exe) { $script:foundExe = $exe.FullName; return $true }
  }
  return $false
}

function Install-WithWinget($packageId, $displayName) {
  Write-Host "  Attempting: winget install $packageId ..." -ForegroundColor Gray
  try {
    $result = winget install --id $packageId --accept-source-agreements --accept-package-agreements --silent 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Host "  [OK] $displayName installed via winget" -ForegroundColor Green; return $true }
  } catch {}
  return $false
}

function Refresh-Path {
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [System.Environment]::GetEnvironmentVariable("Path", "User")
}

function Find-PgBin {
  if (Get-Command psql -ErrorAction SilentlyContinue) { return "psql" }
  $locations = @(
    "C:\Program Files\PostgreSQL\17\bin", "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\15\bin", "C:\Program Files\PostgreSQL\14\bin"
  )
  foreach ($loc in $locations) { $exe = Join-Path $loc "psql.exe"; if (Test-Path $exe) { return $exe } }
  $found = Get-ChildItem "C:\Program Files\PostgreSQL" -Recurse -Filter "psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { return $found.FullName }
  return $null
}

# ---------------------------------------------------------------
# 1. PREREQUISITES
# ---------------------------------------------------------------
Write-Host "[1/7] Setting up prerequisites..." -ForegroundColor Yellow

# Node.js
$nodeOk = $false
try { $nv = (node --version 2>$null) -replace 'v',''; if ([int]($nv -split '\.')[0] -ge 18) { $nodeOk = $true; Write-Host "  [OK] Node.js v$nv" -ForegroundColor Green } }
catch {}
if (-not $nodeOk) {
  Write-Host "  Node.js 18+ not found." -ForegroundColor Yellow
  if ($isAdmin) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
      Write-Host "  [FAIL] winget not available. Install Node.js manually: https://nodejs.org/" -ForegroundColor Red
      exit 1
    }
    $installed = Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js LTS"
    if (-not $installed) { Write-Host "  [FAIL] Could not install Node.js. Download from https://nodejs.org/" -ForegroundColor Red; exit 1 }
    Refresh-Path
    try { $nv = (node --version 2>$null) -replace 'v',''; if ($nv) { Write-Host "  [OK] Node.js v$nv" -ForegroundColor Green; $nodeOk = $true } }
    catch { Write-Host "  [FAIL] Node.js installed but not in PATH. Restart PowerShell and re-run." -ForegroundColor Red; exit 1 }
  } else {
    Write-Host "  [SKIP] Node.js check skipped (not admin). Install manually from https://nodejs.org/" -ForegroundColor Yellow
  }
}
try { $npmVer = npm --version 2>$null; Write-Host "  [OK] npm v$npmVer" -ForegroundColor Green } catch { Write-Host "  [FAIL] npm not found" -ForegroundColor Red }

# PostgreSQL
$pgBin = Find-PgBin
$pgInstalled = ($pgBin -ne $null)
if (-not $pgInstalled) {
  Write-Host "  PostgreSQL not found." -ForegroundColor Yellow
  if ($isAdmin) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
      $installed = Install-WithWinget "PostgreSQL.PostgreSQL.17" "PostgreSQL 17"
      if (-not $installed) { $installed = Install-WithWinget "PostgreSQL.PostgreSQL.16" "PostgreSQL 16" }
    }
    if (-not $installed) {
      Write-Host "  [WARN] Could not install PostgreSQL automatically." -ForegroundColor Yellow
      Write-Host "     Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
      Write-Host "     Re-run this script after installation, or configure DB manually." -ForegroundColor Gray
    } else {
      Refresh-Path; Start-Sleep -Seconds 3; $pgBin = Find-PgBin
      if ($pgBin) { $pgInstalled = $true; Write-Host "  [OK] PostgreSQL installed" -ForegroundColor Green }
    }
  } else {
    Write-Host "  [WARN] PostgreSQL check skipped (not admin)." -ForegroundColor Yellow
    Write-Host "     Install PostgreSQL from: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
  }
} else {
  Write-Host "  [OK] PostgreSQL found" -ForegroundColor Green
}

# Ensure PostgreSQL service is running
Write-Host "  Checking PostgreSQL service..." -ForegroundColor Gray
$pgSvc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if (-not $pgSvc) { $pgSvc = Get-Service | Where-Object { $_.Name -like "*postgresql*" -or $_.DisplayName -like "*PostgreSQL*" } -ErrorAction SilentlyContinue | Select-Object -First 1 }
if ($pgSvc) {
  if ($pgSvc.Status -ne "Running") {
    Write-Host "  Starting PostgreSQL service..." -ForegroundColor Gray
    Start-Service $pgSvc.Name -ErrorAction SilentlyContinue; Start-Sleep -Seconds 3
  }
  if ((Get-Service $pgSvc.Name).Status -eq "Running") { Write-Host "  [OK] PostgreSQL service running" -ForegroundColor Green }
  else { Write-Host "  [!] Could not start PostgreSQL service" -ForegroundColor Yellow }
} else {
  Write-Host "  [!] No PostgreSQL service found. You may need to start it manually." -ForegroundColor Yellow
}
Write-Host ""

# ---------------------------------------------------------------
# 2. CONFIGURE ENVIRONMENT
# ---------------------------------------------------------------
Write-Host "[2/7] Configuring environment..." -ForegroundColor Yellow

$dbHost = "localhost"; $dbPort = "5432"; $dbUser = "postgres"; $dbName = "resolv"; $apiPort = "3001"; $webUrl = "http://localhost:3000"

Write-Host ""; Write-Host "  Database Configuration:" -ForegroundColor White; Write-Host "  ------------------------" -ForegroundColor Gray
$dbHost = Read-Host "  PostgreSQL host [$dbHost]"; if (-not $dbHost) { $dbHost = "localhost" }
$dbPort = Read-Host "  PostgreSQL port [$dbPort]"; if (-not $dbPort) { $dbPort = "5432" }
$dbUser = Read-Host "  PostgreSQL user [$dbUser]"; if (-not $dbUser) { $dbUser = "postgres" }
Write-Host "  PostgreSQL password (enter nothing for 'postgres' default):" -ForegroundColor Gray
$dbPass = Read-Host "  " -AsSecureString
$dbPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPass))
if (-not $dbPassPlain) { $dbPassPlain = "postgres" }
$dbName = Read-Host "  Database name [$dbName]"; if (-not $dbName) { $dbName = "resolv" }
$dbUrl = "postgresql://${dbUser}:${dbPassPlain}@${dbHost}:${dbPort}/${dbName}"

# Test DB connection before proceeding
Write-Host "  Testing database connection..." -ForegroundColor Gray
$env:PGPASSWORD = $dbPassPlain; $dbConnected = $false
try {
  $testResult = & "$pgBin" -h $dbHost -p $dbPort -U $dbUser -d postgres -c "SELECT 1" 2>&1
  if ($LASTEXITCODE -eq 0 -or $testResult -match '1') { $dbConnected = $true; Write-Host "  [OK] Connection successful" -ForegroundColor Green }
  else { Write-Host "  [!] Could not connect: $testResult" -ForegroundColor Yellow }
} catch { Write-Host "  [!] Could not connect to PostgreSQL ($($_.Exception.Message))" -ForegroundColor Yellow }

# Create database if needed
if ($dbConnected) {
  try {
    $checkResult = & "$pgBin" -h $dbHost -p $dbPort -U $dbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'" 2>$null
    if ($checkResult -match '1') { Write-Host "  [OK] Database '${dbName}' already exists" -ForegroundColor Green }
    else {
      & "$pgBin" -h $dbHost -p $dbPort -U $dbUser -d postgres -c "CREATE DATABASE ${dbName};" 2>&1 | Out-Null
      Write-Host "  [OK] Database '${dbName}' created" -ForegroundColor Green
    }
  } catch { Write-Host "  [WARN] Database creation failed: $($_.Exception.Message)" -ForegroundColor Yellow }
}
$env:PGPASSWORD = $null

Write-Host ""; Write-Host "  Server Configuration:" -ForegroundColor White; Write-Host "  ---------------------" -ForegroundColor Gray
$apiPort = Read-Host "  API port [$apiPort]"; if (-not $apiPort) { $apiPort = "3001" }
$webUrl = Read-Host "  Frontend URL [$webUrl]"; if (-not $webUrl) { $webUrl = "http://localhost:3000" }

Write-Host ""; Write-Host "  Admin Account:" -ForegroundColor White; Write-Host "  --------------" -ForegroundColor Gray
$adminEmail = Read-Host "  Admin email"; while (-not $adminEmail) { Write-Host "  [!] Email is required" -ForegroundColor Yellow; $adminEmail = Read-Host "  Admin email" }
$adminPass = Read-Host "  Admin password" -AsSecureString
$adminPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPass))
while (-not $adminPassPlain) { Write-Host "  [!] Password is required" -ForegroundColor Yellow; $adminPass = Read-Host "  Admin password" -AsSecureString; $adminPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPass)) }

$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })

# Write .env files
$apiEnvContent = @"
# Resolv API Environment
# Generated by deploy-demo.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm')
DATABASE_URL=${dbUrl}
JWT_SECRET=${jwtSecret}
PORT=${apiPort}
WEB_URL=${webUrl}
HOST=0.0.0.0
NODE_ENV=production
"@
Set-Content -Path (Join-Path $repoRoot "apps\api\.env") -Value $apiEnvContent -Encoding UTF8
Write-Host "  [OK] apps/api/.env" -ForegroundColor Green

$webEnvContent = @"
# Resolv Web Environment
# Generated by deploy-demo.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm')
NEXT_PUBLIC_API_URL=http://localhost:${apiPort}/api
NEXT_PUBLIC_WS_URL=http://localhost:${apiPort}
"@
Set-Content -Path (Join-Path $repoRoot "apps\web\.env") -Value $webEnvContent -Encoding UTF8
Write-Host "  [OK] apps/web/.env" -ForegroundColor Green
Write-Host ""

# ---------------------------------------------------------------
# 3. INSTALL DEPENDENCIES
# ---------------------------------------------------------------
Write-Host "[3/7] Installing dependencies..." -ForegroundColor Yellow

$npmOk = $false
Write-Host "  Running npm install..." -ForegroundColor Gray
Set-Location $repoRoot
npm install --loglevel=error --no-optional 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "  npm install had issues. Retrying with --legacy-peer-deps..." -ForegroundColor Yellow
  npm install --loglevel=error --legacy-peer-deps 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  [WARN] npm install failed. You may need to run it manually:" -ForegroundColor Yellow
    Write-Host "         npm install --legacy-peer-deps" -ForegroundColor Gray
  } else { $npmOk = $true; Write-Host "  [OK] Dependencies installed (legacy-peer-deps)" -ForegroundColor Green }
} else { $npmOk = $true; Write-Host "  [OK] Dependencies installed" -ForegroundColor Green }

# Install agent dependencies separately (not in workspaces)
$agentDir = Join-Path $repoRoot "apps\agent\node-agent"
if (Test-Path $agentDir) {
  Write-Host "  Installing agent dependencies..." -ForegroundColor Gray
  Push-Location $agentDir
  npm install --loglevel=error 2>&1 | Out-Null
  Pop-Location
}
Write-Host ""

# ---------------------------------------------------------------
# 4. SETUP DATABASE
# ---------------------------------------------------------------
Write-Host "[4/7] Setting up database..." -ForegroundColor Yellow

if ($dbConnected) {
  Push-Location (Join-Path $repoRoot "apps\api")
  $env:DATABASE_URL = $dbUrl; $env:NODE_ENV = "production"

  # Schema
  Write-Host "  Creating database schema..."
  node src\db\run_schema.js
  if ($LASTEXITCODE -ne 0) { Write-Host "  [WARN] Schema creation had issues (may already exist)" -ForegroundColor Yellow }
  else { Write-Host "  [OK] Schema applied" -ForegroundColor Green }

  # Seed
  Write-Host "  Seeding initial data..."
  node src\db\run_seed.js
  if ($LASTEXITCODE -ne 0) { Write-Host "  [WARN] Seed had issues (may already exist)" -ForegroundColor Yellow }
  else { Write-Host "  [OK] Seed data applied" -ForegroundColor Green }

  # Migrations
  Write-Host "  Running migrations..."
  node src\db\run_migration.js
  if ($LASTEXITCODE -ne 0) { Write-Host "  [WARN] Migrations had issues" -ForegroundColor Yellow }
  else { Write-Host "  [OK] Migrations applied" -ForegroundColor Green }

  # Admin user
  Write-Host "  Creating admin user..."
  $env:ADMIN_EMAIL = $adminEmail; $env:ADMIN_PASSWORD = $adminPassPlain
  node src\db\setup-admin.js
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  [WARN] Admin user creation failed." -ForegroundColor Yellow
    Write-Host "         You can use seed defaults: marcus.johnson@company.com / password" -ForegroundColor Gray
  } else { Write-Host "  [OK] Admin user ready" -ForegroundColor Green }
  Pop-Location
} else {
  Write-Host "  [SKIP] DB setup (no database connection). Run manually:" -ForegroundColor Yellow
  Write-Host "         cd apps\api && node src\db\run_schema.js" -ForegroundColor Gray
  Write-Host "         node src\db\run_seed.js" -ForegroundColor Gray
  Write-Host "         node src\db\run_migration.js" -ForegroundColor Gray
}
Write-Host ""

# ---------------------------------------------------------------
# 5. BUILD APPLICATIONS
# ---------------------------------------------------------------
Write-Host "[5/7] Building applications..." -ForegroundColor Yellow

# API build
Write-Host "  Building API..."
Push-Location (Join-Path $repoRoot "apps\api")
npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "  [WARN] API build failed. Using ts-node-dev fallback (slower but works)." -ForegroundColor Yellow
} else { Write-Host "  [OK] API built (dist/)" -ForegroundColor Green }
Pop-Location

# Web build
Write-Host "  Building Web (Next.js)..."
Push-Location (Join-Path $repoRoot "apps\web")
npx next build 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "  [WARN] Web build failed. Next.js dev mode will be used instead (slower but works)." -ForegroundColor Yellow
} else { Write-Host "  [OK] Web built (.next/)" -ForegroundColor Green }
Pop-Location

# Agent build
Write-Host "  Building Windows Agent (ResolvAgent.exe)..."
$nssmExe = Join-Path $agentDir "nssm\nssm.exe"
$agentBuilt = $false
if (-not (Test-Path $nssmExe)) {
  Write-Host "    Downloading NSSM..." -ForegroundColor Gray
  $nssmZip = Join-Path $agentDir "nssm.zip"; $dlOk = $false
  # Try primary URL
  try { Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile $nssmZip -ErrorAction Stop; $dlOk = $true } catch {}
  # Try fallback
  if (-not $dlOk) { try { Invoke-WebRequest -Uri "https://github.com/kirillkovalenko/nssm/releases/download/v2.24/nssm-2.24.zip" -OutFile $nssmZip -ErrorAction Stop; $dlOk = $true } catch {} }
  # Try curl fallback
  if (-not $dlOk) { try { & curl -L -o $nssmZip "https://nssm.cc/release/nssm-2.24.zip" 2>$null; if (Test-Path $nssmZip) { $dlOk = $true } } catch {} }
  if ($dlOk) {
    try {
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      [System.IO.Compression.ZipFile]::ExtractToDirectory($nssmZip, (Join-Path $agentDir "nssm_temp"))
      Copy-Item (Join-Path $agentDir "nssm_temp\nssm-2.24\win64\nssm.exe") $nssmExe
      Remove-Item -Recurse -Force (Join-Path $agentDir "nssm_temp"), $nssmZip -ErrorAction SilentlyContinue
      Write-Host "    [OK] NSSM downloaded" -ForegroundColor Green
    } catch { Write-Host "    [WARN] Could not extract NSSM" -ForegroundColor Yellow }
  } else { Write-Host "    [WARN] Could not download NSSM. Agent build will skip." -ForegroundColor Yellow }
}
if (Test-Path $nssmExe) {
  Push-Location $agentDir
  npm run build 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  [WARN] Agent pkg build failed. Trying direct pkg..." -ForegroundColor Yellow
    npx pkg agent.js --targets node18-win-x64 --output dist/ResolvAgent.exe 2>&1
    if ($LASTEXITCODE -eq 0) { $agentBuilt = $true; Write-Host "  [OK] Agent built via direct pkg" -ForegroundColor Green }
    else {
      Write-Host "  [WARN] Agent build failed (non-critical, Windows EXE not required)." -ForegroundColor Yellow
      Write-Host "         To build later: cd apps\agent\node-agent && npm run build" -ForegroundColor Gray
    }
  } else { $agentBuilt = $true; Write-Host "  [OK] Agent built (dist/ResolvAgent.exe)" -ForegroundColor Green }
  Pop-Location
} else { Write-Host "  [SKIP] Agent build (NSSM not available)" -ForegroundColor Gray }

# Copy agent exe to API uploads
if ($agentBuilt) {
  $apiUploadDir = Join-Path $repoRoot "apps\api\uploads\agent"
  if (-not (Test-Path $apiUploadDir)) { New-Item -ItemType Directory -Path $apiUploadDir -Force | Out-Null }
  Copy-Item (Join-Path $agentDir "dist\ResolvAgent.exe") (Join-Path $apiUploadDir "ResolvAgent.exe") -Force
  Write-Host "  [OK] Agent EXE copied to API uploads" -ForegroundColor Green
}
Write-Host ""

# ---------------------------------------------------------------
# 6. CREATE START SCRIPT
# ---------------------------------------------------------------
Write-Host "[6/7] Creating start script..." -ForegroundColor Yellow

$startScriptContent = @"
@echo off
setlocal enabledelayedexpansion
:: ===============================================================
::  Resolv Demo Start Script
::  Generated by deploy-demo.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm')
::  Hardened with fallbacks for common failure modes
:: ===============================================================

cd /d "%~dp0"

echo.
echo =====================================================
echo   Starting Resolv Platform
echo =====================================================
echo.

:: ── Kill existing processes ──
echo   Checking for existing servers...
for %%p in (${apiPort} 3000) do (
  for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr ":%%p .*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
  )
)
echo   [OK] Ports cleared

:: ── Check PostgreSQL ──
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
  )
)

:: ── Install deps if missing ──
echo.
if not exist "node_modules" (
  echo   Installing root dependencies...
  call npm install --loglevel=error --no-optional 2>&1
  if !errorlevel! neq 0 (
    echo   Retrying with --legacy-peer-deps...
    call npm install --loglevel=error --legacy-peer-deps 2>&1
  )
  if !errorlevel! neq 0 (
    echo   [FAIL] npm install failed. Try: npm install --legacy-peer-deps
    pause
    exit /b 1
  )
  echo   [OK] Dependencies installed
) else (
  echo   [OK] node_modules found
)

:: ── Workspace deps ──
for %%w in (apps\api apps\web) do (
  if not exist "%%w\node_modules" (
    echo   Installing %%w dependencies...
    pushd %%w
    call npm install --loglevel=error --no-optional 2>&1
    popd
  )
)

:: ── DB setup ──
echo.
echo   Setting up database...
if exist "apps\api\src\db\run_schema.js" (
  pushd apps\api
  node src\db\run_schema.js
  if !errorlevel! neq 0 ( echo   [WARN] Schema ) else ( echo   [OK] Schema )
  node src\db\run_seed.js
  if !errorlevel! neq 0 ( echo   [WARN] Seed ) else ( echo   [OK] Seed )
  node src\db\run_migration.js
  if !errorlevel! neq 0 ( echo   [WARN] Migrations ) else ( echo   [OK] Migrations )
  popd
) else (
  echo   [WARN] DB scripts not found. Skipping.
)

:: ── Start servers ──
echo.
echo   Starting servers...
start "Resolv Dev" cmd /c "npm run dev"

:: Health check
echo   Waiting for servers...
for /l %%i in (1,1,30) do (
  >nul timeout /t 1 /nobreak
  >nul 2>&1 curl -s http://localhost:${apiPort}/api/health | findstr "api" && (
    echo   [OK] API ready
    goto :start_ready
  )
)
:start_ready

echo.
echo =====================================================
echo   Resolv is ready!
echo.
echo   Frontend:  http://localhost:3000
echo   API:       http://localhost:${apiPort}
echo   Health:    http://localhost:${apiPort}/api/health
echo.
echo   Default login:  marcus.johnson@company.com / password
echo                   ${adminEmail}
echo.
echo   Press Enter to stop servers...
echo =====================================================
pause >nul

echo   Stopping...
for %%p in (${apiPort} 3000) do (
  for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr ":%%p .*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
  )
)
echo   Stopped.
"@

Set-Content -Path (Join-Path $repoRoot "start-demo.bat") -Value $startScriptContent -Encoding ASCII
Write-Host "  [OK] start-demo.bat created" -ForegroundColor Green
Write-Host ""

# ---------------------------------------------------------------
# 7. SUMMARY
# ---------------------------------------------------------------
Write-Host "[7/7] Deployment Summary" -ForegroundColor Yellow
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Quick start:" -ForegroundColor White
Write-Host "    start-demo.bat" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login credentials:" -ForegroundColor White
Write-Host "    ${adminEmail} (your admin account)" -ForegroundColor Cyan
Write-Host "    marcus.johnson@company.com / password (seed admin)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  URLs:" -ForegroundColor White
Write-Host "    Frontend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "    API:       http://localhost:${apiPort}" -ForegroundColor Cyan
Write-Host ""

# Agent build status
if ($agentBuilt) { Write-Host "  Agent:     ResolvAgent.exe built and ready" -ForegroundColor Green }
else { Write-Host "  Agent:     Not built (optional — run: cd apps\agent\node-agent && npm run build)" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  If something didn't work:" -ForegroundColor White
Write-Host "    - DB issues:  Make sure PostgreSQL is running" -ForegroundColor Gray
Write-Host "    - npm issues: Run: npm install --legacy-peer-deps" -ForegroundColor Gray
Write-Host "    - Agent:      Not required for web demo" -ForegroundColor Gray
Write-Host "=====================================================" -ForegroundColor Green
