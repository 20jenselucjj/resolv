# ===============================================================
#  Resolv Demo Deployment Script
#  Sets up the IT service management platform on any Windows PC
# ===============================================================

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $MyInvocation.MyCommand.Path -Parent

# Check admin rights (needed for installing software)
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "[!] Not running as Administrator." -ForegroundColor Yellow
  Write-Host "   Installing Node.js or PostgreSQL will fail without admin rights." -ForegroundColor Yellow
  Write-Host "   Re-run PowerShell as Administrator if you need software installed." -ForegroundColor Yellow
  Write-Host ""
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Resolv - IT Service Management Platform" -ForegroundColor Cyan
Write-Host "  Demo Deployment Script" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------
# 1. PREREQUISITES - AUTO-INSTALL MISSING SOFTWARE
# ---------------------------------------------------------------
Write-Host "[1/6] Setting up prerequisites..." -ForegroundColor Yellow

# ---- Helper: find a command on PATH or in common install locations ----
function Find-Command($cmd, $checkArgs, $searchDirs) {
  # Try PATH first
  try {
    $r = & $cmd $checkArgs 2>$null
    if ($LASTEXITCODE -eq 0 -or $r -match '\d+\.\d+') { return $true }
  } catch {}
  # Search disk
  foreach ($base in $searchDirs) {
    if (-not (Test-Path $base)) { continue }
    foreach ($dir in (Get-ChildItem $base -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending)) {
      $exe = Join-Path $dir.FullName "bin\$cmd.exe"
      if (Test-Path $exe) {
        try { & $exe $checkArgs 2>$null | Out-Null; $script:foundExe = $exe; return $true } catch {}
      }
    }
  }
  # Final fallback: walk bin directories
  foreach ($base in $searchDirs) {
    $exe = Get-ChildItem $base -Recurse -Filter "$cmd.exe" -ErrorAction SilentlyContinue | Sort-Object FullName | Select-Object -First 1
    if ($exe) { $script:foundExe = $exe.FullName; return $true }
  }
  return $false
}

# ---- Install via winget (Windows 10+, built-in) ----
function Install-WithWinget($packageId, $displayName) {
  Write-Host "  Attempting: winget install $packageId ..." -ForegroundColor Gray
  try {
    $result = winget install --id $packageId --accept-source-agreements --accept-package-agreements --silent 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  [OK] $displayName installed via winget" -ForegroundColor Green
      return $true
    }
  } catch {}
  return $false
}

# ---- Refresh PATH environment variable ----
function Refresh-Path {
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# ---- Find PostgreSQL bin directory across versions ----
function Find-PgBin {
  # Check PATH
  if (Get-Command psql -ErrorAction SilentlyContinue) { return "psql" }
  # Check common locations
  $locations = @(
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\15\bin",
    "C:\Program Files\PostgreSQL\14\bin"
  )
  foreach ($loc in $locations) {
    $exe = Join-Path $loc "psql.exe"
    if (Test-Path $exe) { return $exe }
  }
  # Search Program Files
  $found = Get-ChildItem "C:\Program Files\PostgreSQL" -Recurse -Filter "psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { return $found.FullName }
  return $null
}

# ======== CHECK / INSTALL NODE.JS ========
$nodeOk = $false
try { $nv = (node --version 2>$null) -replace 'v',''; if ([int]($nv -split '\.')[0] -ge 18) { $nodeOk = $true; Write-Host "  [OK] Node.js v$nv" -ForegroundColor Green } }
catch {}
if (-not $nodeOk) {
  Write-Host "  Node.js 18+ not found. Installing..." -ForegroundColor Yellow
  if ($isAdmin) {
    $installed = Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js LTS"
    if (-not $installed) {
      Write-Host "  [FAIL] Could not install Node.js automatically." -ForegroundColor Red
      Write-Host "     Download manually: https://nodejs.org/ (LTS version)" -ForegroundColor Gray
      exit 1
    }
    Refresh-Path
    try { $nv = (node --version 2>$null) -replace 'v',''; if ($nv) { Write-Host "  [OK] Node.js v$nv" -ForegroundColor Green; $nodeOk = $true } }
    catch { Write-Host "  [FAIL] Node.js installed but not in PATH. Restart PowerShell and re-run." -ForegroundColor Red; exit 1 }
  } else {
    Write-Host "  [FAIL] Node.js 18+ required but not installed." -ForegroundColor Red
    Write-Host "     Run this script as Administrator or install Node.js manually." -ForegroundColor Gray
    Write-Host "     Download: https://nodejs.org/" -ForegroundColor Gray
    exit 1
  }
}
try { $npmVer = npm --version 2>$null; Write-Host "  [OK] npm v$npmVer" -ForegroundColor Green }
catch { Write-Host "  [FAIL] npm not found (should come with Node.js)" -ForegroundColor Red; exit 1 }

# ======== CHECK / INSTALL POSTGRESQL ========
$pgBin = Find-PgBin
$pgInstalled = ($pgBin -ne $null)

if (-not $pgInstalled) {
  Write-Host "  PostgreSQL not found. Installing..." -ForegroundColor Yellow
  if ($isAdmin) {
    $installed = Install-WithWinget "PostgreSQL.PostgreSQL.17" "PostgreSQL 17"
    if (-not $installed) {
      $installed = Install-WithWinget "PostgreSQL.PostgreSQL.16" "PostgreSQL 16"
    }
    if (-not $installed) {
      Write-Host "  [FAIL] Could not install PostgreSQL automatically." -ForegroundColor Red
      Write-Host "     Download manually: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
      Write-Host "     Install with default options. Set superuser password to 'postgres' for simplicity." -ForegroundColor Gray
      exit 1
    }
    Refresh-Path
    Start-Sleep -Seconds 3
    $pgBin = Find-PgBin
    if ($pgBin) { $pgInstalled = $true; Write-Host "  [OK] PostgreSQL installed" -ForegroundColor Green }
    else { Write-Host "  [FAIL] PostgreSQL installed but psql not found. Restart PowerShell and re-run." -ForegroundColor Red; exit 1 }
  } else {
    Write-Host "  [FAIL] PostgreSQL required but not installed." -ForegroundColor Red
    Write-Host "     Run this script as Administrator or install PostgreSQL manually." -ForegroundColor Gray
    Write-Host "     Download: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
    exit 1
  }
} else {
  Write-Host "  [OK] PostgreSQL found" -ForegroundColor Green
}

# ======== ENSURE POSTGRESQL SERVICE IS RUNNING ========
Write-Host "  Ensuring PostgreSQL service is running..." -ForegroundColor Gray
$svc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if (-not $svc) {
  # Try alternate name format
  $svc = Get-Service | Where-Object { $_.DisplayName -like "*PostgreSQL*" -and $_.Name -notlike "*x64*" } -ErrorAction SilentlyContinue | Select-Object -First 1
}
if ($svc) {
  if ($svc.Status -ne "Running") {
    Start-Service $svc.Name -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
  }
  if ((Get-Service $svc.Name).Status -eq "Running") {
    Write-Host "  [OK] PostgreSQL service running" -ForegroundColor Green
  } else {
    Write-Host "  [!]  Could not start PostgreSQL service. Try starting it manually." -ForegroundColor Yellow
  }
} else {
  Write-Host "  [!]  No PostgreSQL service found. You may need to start PostgreSQL manually." -ForegroundColor Yellow
}

# ======== STORE PSQL PATH FOR LATER USE ========
$pgSql = $pgBin
Write-Host ""

# ---------------------------------------------------------------
# 2. CONFIGURE ENVIRONMENT
# ---------------------------------------------------------------
Write-Host "[2/6] Configuring environment..." -ForegroundColor Yellow

# Default values
$dbHost = "localhost"
$dbPort = "5432"
$dbUser = "postgres"
$dbName = "resolv"
$apiPort = "3001"
$webUrl = "http://localhost:3000"

Write-Host ""
Write-Host "  Database Configuration:" -ForegroundColor White
Write-Host "  ------------------------" -ForegroundColor Gray
$dbHost = Read-Host "  PostgreSQL host [$dbHost]"; if (-not $dbHost) { $dbHost = "localhost" }
$dbPort = Read-Host "  PostgreSQL port [$dbPort]"; if (-not $dbPort) { $dbPort = "5432" }
$dbUser = Read-Host "  PostgreSQL user [$dbUser]"; if (-not $dbUser) { $dbUser = "postgres" }
Write-Host "  PostgreSQL password (enter nothing for 'postgres' default):" -ForegroundColor Gray
$dbPass = Read-Host "  " -AsSecureString
$dbPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPass))
if (-not $dbPassPlain) { $dbPassPlain = "postgres" }
$dbName = Read-Host "  Database name [$dbName]"; if (-not $dbName) { $dbName = "resolv" }

$dbUrl = "postgresql://${dbUser}:${dbPassPlain}@${dbHost}:${dbPort}/${dbName}"

# ---- CREATE DATABASE IF NEEDED ----
Write-Host ""
Write-Host "  Checking database '${dbName}'..." -ForegroundColor Gray
$env:PGPASSWORD = $dbPassPlain
if ($pgSql -eq "psql") {
  $pgCheckCmd = "psql"
} else {
  $pgCheckCmd = "& `"$pgSql`""
}
$dbExists = $false
try {
  $checkResult = & "$pgSql" -h $dbHost -p $dbPort -U $dbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'" 2>$null
  if ($checkResult -match '1') { $dbExists = $true }
} catch {}

if ($dbExists) {
  Write-Host "  [OK] Database '${dbName}' already exists" -ForegroundColor Green
} else {
  Write-Host "  Creating database '${dbName}'..." -ForegroundColor Yellow
  try {
    & "$pgSql" -h $dbHost -p $dbPort -U $dbUser -d postgres -c "CREATE DATABASE ${dbName};" 2>&1 | Out-Null
    Write-Host "  [OK] Database '${dbName}' created" -ForegroundColor Green
  } catch {
    if ($_.Exception.Message -match "already exists") {
      Write-Host "  [OK] Database '${dbName}' already exists" -ForegroundColor Green
    } else {
      Write-Host "  [FAIL] Could not create database: $($_.Exception.Message)" -ForegroundColor Red
      Write-Host "     Create it manually: psql -U ${dbUser} -c 'CREATE DATABASE ${dbName};'" -ForegroundColor Gray
      $env:PGPASSWORD = $null
      exit 1
    }
  }
}
$env:PGPASSWORD = $null

Write-Host ""
Write-Host "  Server Configuration:" -ForegroundColor White
Write-Host "  ---------------------" -ForegroundColor Gray
$apiPort = Read-Host "  API port [$apiPort]"; if (-not $apiPort) { $apiPort = "3001" }
$webUrl = Read-Host "  Frontend URL [$webUrl]"; if (-not $webUrl) { $webUrl = "http://localhost:3000" }

Write-Host ""
Write-Host "  Admin Account:" -ForegroundColor White
Write-Host "  --------------" -ForegroundColor Gray
Write-Host "  Creating admin user for initial login." -ForegroundColor Gray
$adminEmail = Read-Host "  Admin email"
while (-not $adminEmail) {
  Write-Host "  [!]  Email is required" -ForegroundColor Yellow
  $adminEmail = Read-Host "  Admin email"
}
$adminPass = Read-Host "  Admin password" -AsSecureString
$adminPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPass))
while (-not $adminPassPlain) {
  Write-Host "  [!]  Password is required" -ForegroundColor Yellow
  $adminPass = Read-Host "  Admin password" -AsSecureString
  $adminPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPass))
}

# Generate JWT secret
$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })

# Write API .env
$apiEnvPath = Join-Path $repoRoot "apps\api\.env"
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
Set-Content -Path $apiEnvPath -Value $apiEnvContent -Encoding UTF8
Write-Host "  [OK] apps/api/.env" -ForegroundColor Green

# Write Web .env
$webEnvPath = Join-Path $repoRoot "apps\web\.env"
$webEnvContent = @"
# Resolv Web Environment
# Generated by deploy-demo.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm')

NEXT_PUBLIC_API_URL=http://localhost:${apiPort}/api
NEXT_PUBLIC_WS_URL=http://localhost:${apiPort}
"@
Set-Content -Path $webEnvPath -Value $webEnvContent -Encoding UTF8
Write-Host "  [OK] apps/web/.env" -ForegroundColor Green

Write-Host ""

# ---------------------------------------------------------------
# 3. INSTALL DEPENDENCIES
# ---------------------------------------------------------------
Write-Host "[3/6] Installing dependencies..." -ForegroundColor Yellow
Set-Location $repoRoot
npm install --loglevel=error
if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] npm install failed" -ForegroundColor Red
  exit 1
}
Write-Host "  [OK] Dependencies installed" -ForegroundColor Green
Write-Host ""

# ---------------------------------------------------------------
# 4. SETUP DATABASE
# ---------------------------------------------------------------
Write-Host "[4/6] Setting up database..." -ForegroundColor Yellow

$schemaScript = Join-Path $repoRoot "apps\api\src\db\run_schema.js"
$seedScript = Join-Path $repoRoot "apps\api\src\db\run_seed.js"
$migrationScript = Join-Path $repoRoot "apps\api\src\db\run_migration.js"
$adminScript = Join-Path $repoRoot "apps\api\src\db\setup-admin.js"

# Run schema
Write-Host "  Creating database schema..."
Push-Location (Join-Path $repoRoot "apps\api")
$env:DATABASE_URL = $dbUrl
$env:NODE_ENV = "production"
node $schemaScript
if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] Schema creation failed" -ForegroundColor Red
  Write-Host "   Make sure PostgreSQL is running and the database '${dbName}' exists." -ForegroundColor Gray
  Write-Host "   To create it: psql -U ${dbUser} -c 'CREATE DATABASE ${dbName};'" -ForegroundColor Gray
  Pop-Location
  exit 1
}
Write-Host "  [OK] Schema applied" -ForegroundColor Green

# Run seed data
Write-Host "  Seeding initial data..."
$env:DATABASE_URL = $dbUrl
node $seedScript
if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] Seed data failed" -ForegroundColor Red
  Pop-Location
  exit 1
}
Write-Host "  [OK] Seed data applied" -ForegroundColor Green

# Run migrations
Write-Host "  Running migrations..."
$env:DATABASE_URL = $dbUrl
node $migrationScript
if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] Migrations failed" -ForegroundColor Red
  Pop-Location
  exit 1
}
Write-Host "  [OK] Migrations applied" -ForegroundColor Green

# Create admin user
Write-Host "  Creating admin user..."
$env:DATABASE_URL = $dbUrl
$env:ADMIN_EMAIL = $adminEmail
$env:ADMIN_PASSWORD = $adminPassPlain
node $adminScript
if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] Admin user creation failed" -ForegroundColor Red
  Pop-Location
  exit 1
}
Write-Host "  [OK] Admin user ready" -ForegroundColor Green
Pop-Location
Write-Host ""

# ---------------------------------------------------------------
# 5. BUILD APPLICATIONS
# ---------------------------------------------------------------
Write-Host "[5/6] Building applications..." -ForegroundColor Yellow

# Build API
Write-Host "  Building API..."
Push-Location (Join-Path $repoRoot "apps\api")
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] API build failed" -ForegroundColor Red
  Pop-Location
  exit 1
}
Write-Host "  [OK] API built (dist/)" -ForegroundColor Green
Pop-Location

# Build Web
Write-Host "  Building Web (Next.js)..."
Push-Location (Join-Path $repoRoot "apps\web")
npx next build
if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] Web build failed" -ForegroundColor Red
  Pop-Location
  exit 1
}
Write-Host "  [OK] Web built (.next/)" -ForegroundColor Green
Pop-Location
Write-Host ""

# ---------------------------------------------------------------
# 6. CREATE START SCRIPT
# ---------------------------------------------------------------
Write-Host "[6/6] Creating start script..." -ForegroundColor Yellow

$startScriptContent = @"
# ===============================================================
#  Resolv Demo Start Script
#  Generated by deploy-demo.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm')
# ===============================================================

`$ErrorActionPreference = "Continue"
`$repoRoot = Split-Path `$MyInvocation.MyCommand.Path -Parent
`$apiDir = Join-Path `$repoRoot "apps\api"
`$webDir = Join-Path `$repoRoot "apps\web"

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Starting Resolv Platform" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Kill existing processes on these ports
`$ports = @(${apiPort}, 3000)
foreach (`$port in `$ports) {
  try {
    `$connections = netstat -ano -p tcp 2>`$null | Select-String ":`$port\s+.*LISTENING"
    foreach (`$conn in `$connections) {
      `$pid = (`$conn -split '\s+' | Where-Object { `$_ -match '^\d+$' } | Select-Object -Last 1)
      if (`$pid) {
        Stop-Process -Id `$pid -Force -ErrorAction SilentlyContinue
        Write-Host "  Killed process on port `$port (PID `$pid)" -ForegroundColor Gray
      }
    }
  } catch {}
}

# Start API
Write-Host ""
Write-Host "  Starting API server on port ${apiPort}..." -ForegroundColor Yellow
`$apiProcess = Start-Process -FilePath "node" -ArgumentList "dist/index.js" -WorkingDirectory `$apiDir -PassThru -WindowStyle Minimized
Start-Sleep -Seconds 3

# Start Web
Write-Host "  Starting Web server on port 3000..." -ForegroundColor Yellow
`$webProcess = Start-Process -FilePath "npx" -ArgumentList "next start" -WorkingDirectory `$webDir -PassThru -WindowStyle Minimized
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  Resolv is ready!" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  API:       http://localhost:${apiPort}" -ForegroundColor Cyan
Write-Host "  Health:    http://localhost:${apiPort}/api/health" -ForegroundColor Cyan
Write-Host "" -ForegroundColor Green
Write-Host "  Login with your admin account credentials." -ForegroundColor White
Write-Host "" -ForegroundColor Green
Write-Host "  Press any key to stop both servers..." -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Green

`$null = `$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "  Stopping servers..." -ForegroundColor Yellow
if (`$apiProcess -and -not `$apiProcess.HasExited) { Stop-Process -Id `$apiProcess.Id -Force -ErrorAction SilentlyContinue }
if (`$webProcess -and -not `$webProcess.HasExited) { Stop-Process -Id `$webProcess.Id -Force -ErrorAction SilentlyContinue }

# Clean up ports
foreach (`$port in `$ports) {
  try {
    `$connections = netstat -ano -p tcp 2>`$null | Select-String ":`$port\s+.*LISTENING"
    foreach (`$conn in `$connections) {
      `$pid = (`$conn -split '\s+' | Where-Object { `$_ -match '^\d+$' } | Select-Object -Last 1)
      if (`$pid) { Stop-Process -Id `$pid -Force -ErrorAction SilentlyContinue }
    }
  } catch {}
}

Write-Host "  Servers stopped." -ForegroundColor Gray
"@

$startScriptPath = Join-Path $repoRoot "start-demo.ps1"
Set-Content -Path $startScriptPath -Value $startScriptContent -Encoding UTF8
Write-Host "  [OK] start-demo.ps1 created" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  To start the application:" -ForegroundColor White
Write-Host "    .\start-demo.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Or start services individually:" -ForegroundColor White
Write-Host "    API:  cd apps\api && node dist\index.js" -ForegroundColor Gray
Write-Host "    Web:  cd apps\web && npx next start" -ForegroundColor Gray
Write-Host ""
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  API:       http://localhost:${apiPort}" -ForegroundColor Cyan
Write-Host "  Admin login: ${adminEmail}" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Green
