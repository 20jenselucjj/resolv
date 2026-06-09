# Resolv Agent Deployment Script
# Run this as Administrator

$ErrorActionPreference = "Stop"

$sourceExe = "C:\Users\lucas.jensen\Downloads\resolv-main\apps\agent\node-agent\dist\ResolvAgent.exe"
$destDir = "C:\ProgramData\Resolv\Agent"
$destExe = "$destDir\ResolvAgent.exe"
$serviceName = "ResolvAgent"

Write-Host "=== Resolv Agent Deployment ===" -ForegroundColor Cyan

# Check if source exists
if (-not (Test-Path $sourceExe)) {
    Write-Host "ERROR: Source exe not found at $sourceExe" -ForegroundColor Red
    exit 1
}

# Check if service exists
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "ERROR: Service '$serviceName' not found" -ForegroundColor Red
    exit 1
}

Write-Host "Stopping service..." -ForegroundColor Yellow
Stop-Service -Name $serviceName -Force
Start-Sleep -Seconds 2

Write-Host "Backing up current exe..." -ForegroundColor Yellow
if (Test-Path $destExe) {
    $backupPath = "$destExe.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $destExe $backupPath
    Write-Host "  Backed up to: $backupPath" -ForegroundColor Gray
}

Write-Host "Copying new exe..." -ForegroundColor Yellow
Copy-Item $sourceExe $destExe -Force

Write-Host "Starting service..." -ForegroundColor Yellow
Start-Service -Name $serviceName
Start-Sleep -Seconds 3

# Check status
$service = Get-Service -Name $serviceName
if ($service.Status -eq "Running") {
    Write-Host "Service started successfully" -ForegroundColor Green
} else {
    Write-Host "Service failed to start (Status: $($service.Status))" -ForegroundColor Red
    exit 1
}

# Check logs
$logFile = "$destDir\logs\agent-stdout.log"
if (Test-Path $logFile) {
    Write-Host "Recent agent logs:" -ForegroundColor Cyan
    Get-Content $logFile -Tail 10
}

Write-Host "=== Deployment Complete ===" -ForegroundColor Green
