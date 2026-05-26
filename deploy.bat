@echo off
echo Stopping ResolvAgent service...
sc.exe stop ResolvAgent
timeout /t 4 /nobreak >nul
echo Copying new exe...
copy /y "C:\Users\lucas.jensen\Downloads\resolv-main\apps\agent\node-agent\dist\ResolvAgent.exe" "C:\ProgramData\Resolv\Agent\ResolvAgent.exe"
echo Deleting old cache...
del /f /q "C:\Windows\Temp\resolv_capture.ps1" 2>nul
del /f /q "C:\Windows\Temp\resolv_input_helper.ps1" 2>nul
del /f /q "C:\Windows\Temp\resolv_input_helper.pid" 2>nul
del /f /q "C:\Windows\Temp\resolv_input_helper.stop" 2>nul
if exist "C:\Windows\Temp\resolv_input\" rmdir /s /q "C:\Windows\Temp\resolv_input\"
echo Starting ResolvAgent service...
sc.exe start ResolvAgent
timeout /t 5 /nobreak >nul
sc.exe query ResolvAgent
echo Done.
pause
