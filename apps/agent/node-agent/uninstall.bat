@echo off
:: Self-elevate via UAC if not already running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Uninstalling Resolv Agent...

:: Stop the running agent process (just in case)
taskkill /F /FI "WINDOWTITLE eq Resolv Agent*" >nul 2>&1
powershell -NoProfile -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'agent.js' } | Stop-Process -Force" >nul 2>&1

:: Stop and remove the Windows Service
echo Stopping ResolvAgent service...
sc stop ResolvAgent >nul 2>&1
sc delete ResolvAgent >nul 2>&1

:: Remove old scheduled task if upgrading from previous version
schtasks /end /tn "Resolv Agent" >nul 2>&1
schtasks /delete /tn "Resolv Agent" /f >nul 2>&1

:: Remove installation directory (kills config.json, stale tokens, everything)
set DEST=%PROGRAMDATA%\Resolv\Agent
if exist "%DEST%" (
  rmdir /S /Q "%DEST%"
  echo Removed %DEST%
)

:: Remove parent dir if empty
for /f %%A in ('dir /b /a "%PROGRAMDATA%\Resolv" 2^>nul ^| find /v /c ""') do set COUNT=%%A
if "%COUNT%"=="0" rmdir /Q "%PROGRAMDATA%\Resolv" >nul 2>&1

echo Done! Resolv Agent has been uninstalled.
pause
