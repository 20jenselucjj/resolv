@echo off
:: Self-elevate via UAC if not already running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo =============================================
echo  Resolv Agent Installer
echo =============================================
echo.

cd /d "%~dp0"

:: Detect if we have the standalone EXE or JS source
set HAS_EXE=0
if exist "%~dp0ResolvAgent.exe" set HAS_EXE=1

if %HAS_EXE%==1 (
  echo [OK] Standalone ResolvAgent.exe found  (42 MB)
  echo      No Node.js or npm install needed.
  echo.
) else (
  echo [..] JS source mode — Node.js required.
  where node >nul 2>&1
  if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    echo         Or build the standalone EXE with: npm run build
    pause
    exit /b 1
  )
  for /f "delims=" %%i in ('where node') do set NODE_PATH=%%i
  echo [OK] Node.js found: %NODE_PATH%
  echo [..] Installing npm dependencies...
  call npm install --omit=dev --quiet
  if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Check your internet connection.
    pause
    exit /b 1
  )
  echo [OK] Dependencies installed.
)

:: Install to ProgramData
set DEST=%PROGRAMDATA%\Resolv\Agent
if not exist "%DEST%" mkdir "%DEST%"

:: Remove stale config so agent re-registers fresh
if exist "%DEST%\config.json" del "%DEST%\config.json"

if %HAS_EXE%==1 (
  :: EXE mode — just copy the exe + scripts
  copy /Y "%~dp0ResolvAgent.exe" "%DEST%\" >nul
  copy /Y "%~dp0uninstall.bat" "%DEST%\" >nul
  echo [OK] Copied ResolvAgent.exe to %DEST%
) else (
  :: JS mode — copy all source files
  echo [..] Copying files to %DEST%...
  xcopy /E /Y /Q "%~dp0*" "%DEST%\" >nul
  :: Skip node_modules in source (shouldn't exist but just in case)
  if exist "%DEST%\node_modules" rmdir /S /Q "%DEST%\node_modules" >nul 2>&1
  echo [OK] Files copied to %DEST%
)

:: Create a wrapper batch file so the Windows Service can run the agent
:: with proper working directory and logging.
:: %%~dp0 is used so it expands at runtime (when run-agent.bat runs).
if %HAS_EXE%==1 (
  > "%DEST%\run-agent.bat" (
    echo @echo off
    echo "%%~dp0ResolvAgent.exe" ^>^> "%%~dp0agent.log" 2^>^&1
  )
) else (
  > "%DEST%\run-agent.bat" (
    echo @echo off
    echo cd /d "%%~dp0"
    echo "%NODE_PATH%" "%%~dp0agent.js" ^>^> "%%~dp0agent.log" 2^>^&1
  )
)

:: Remove old scheduled task if upgrading from previous version
schtasks /delete /tn "Resolv Agent" /f >nul 2>&1

:: Stop and delete any previous service
sc stop ResolvAgent >nul 2>&1
sc delete ResolvAgent >nul 2>&1

:: Install as a Windows Service
echo [..] Creating Windows Service 'ResolvAgent'...
sc create ResolvAgent binPath= "%DEST%\run-agent.bat" start=auto DisplayName="Resolv ITSM Agent" obj="NT AUTHORITY\SYSTEM" type=own
if %errorlevel% neq 0 (
  echo [ERROR] Failed to create service. Try running as Administrator.
  pause
  exit /b 1
)

:: Configure service to auto-restart on failure
sc failure ResolvAgent reset=86400 actions=restart/5000/restart/10000/restart/30000 >nul 2>&1

:: Set service description
sc description ResolvAgent "Collects system inventory and enables remote desktop for Resolv ITSM." >nul 2>&1

:: Start the service
echo [..] Starting ResolvAgent service...
sc start ResolvAgent >nul 2>&1
if %errorlevel% neq 0 (
  echo [WARN] Service created but failed to start.
  echo        Check services.msc or run: sc query ResolvAgent
) else (
  echo [OK] Service started successfully.
)

echo.
echo =============================================
echo  ResolvAgent installed as a Windows Service
echo =============================================
echo.
echo  View in services.msc:  services.msc
echo  Check status:          sc query ResolvAgent
echo  View logs:             type "%DEST%\agent.log"
echo  Uninstall:             run uninstall.bat
echo.
pause
