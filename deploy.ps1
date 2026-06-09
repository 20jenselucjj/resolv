# Single command: stop, copy, clear config, start
$ErrorActionPreference = "Stop"
Write-Host "=== Resolv Agent Deploy ===" -ForegroundColor Cyan

try { net stop ResolvAgent 2>&1 | Out-Null } catch {}
Start-Sleep -Seconds 2

Copy-Item -Force "C:\Users\lucas.jensen\Downloads\resolv-main\apps\agent\node-agent\dist\ResolvAgent.exe" "C:\ProgramData\Resolv\Agent\ResolvAgent.exe"
Write-Host "Copied new exe" -ForegroundColor Green

# Clear old credentials so registration runs fresh
Remove-Item "C:\ProgramData\Resolv\Agent\config.json" -ErrorAction SilentlyContinue
Write-Host "Cleared old config" -ForegroundColor Gray

net start ResolvAgent 2>&1 | Out-Null
Start-Sleep -Seconds 3

$s = Get-Service ResolvAgent
Write-Host "Service: $($s.Status)" -ForegroundColor $(if($s.Status -eq 'Running'){'Green'}else{'Red'})

Write-Host "=== Done ===" -ForegroundColor Cyan
