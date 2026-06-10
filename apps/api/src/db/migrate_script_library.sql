-- Script Library: pre-built and custom scripts for remote execution

CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  target_os VARCHAR(50) NOT NULL DEFAULT 'windows',
  script_type VARCHAR(20) NOT NULL DEFAULT 'powershell' CHECK (script_type IN ('powershell', 'cmd', 'batch')),
  script_content TEXT NOT NULL,
  parameters JSONB DEFAULT '[]',
  -- parameters format: [{ name: string, label: string, type: 'text'|'number'|'select', required: boolean, default: any, options?: string[] }]
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If the table already existed without is_builtin (e.g. from agent schema), add it
DO $$ BEGIN
  ALTER TABLE scripts ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_scripts_category ON scripts (category);
CREATE INDEX IF NOT EXISTS idx_scripts_builtin ON scripts (is_builtin);

-- Seed built-in scripts
INSERT INTO scripts (name, description, category, script_type, script_content, is_builtin) VALUES
('Clear Print Spooler', 'Stops the print spooler service, clears all pending jobs, and restarts the service', 'troubleshooting', 'powershell', 'Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue; Remove-Item -Path "$env:SystemRoot\\System32\\spool\\PRINTERS\\*" -Force -ErrorAction SilentlyContinue; Start-Service -Name Spooler; Write-Output "Print spooler cleared and restarted"', true),
('Flush DNS Cache', 'Clears the DNS resolver cache', 'networking', 'powershell', 'ipconfig /flushdns; Write-Output "DNS cache flushed successfully"', true),
('Reset Network Adapter', 'Disables and re-enables the primary network adapter', 'networking', 'powershell', '$adapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1; if ($adapter) { Disable-NetAdapter -Name $adapter.Name -Confirm:$false; Start-Sleep -Seconds 3; Enable-NetAdapter -Name $adapter.Name -Confirm:$false; Write-Output "Adapter $($adapter.Name) reset successfully" } else { Write-Error "No active adapter found" }', true),
('Disk Cleanup', 'Removes temporary files, Windows Update cache, and recycle bin', 'maintenance', 'powershell', 'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -Path "C:\\Windows\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -Path "C:\\Windows\\SoftwareDistribution\\Download\\*" -Recurse -Force -ErrorAction SilentlyContinue; Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Output "Disk cleanup completed"', true),
('System Information', 'Collects detailed system information', 'diagnostics', 'powershell', 'Get-ComputerInfo | Select-Object CsName, WindowsProductName, WindowsVersion, OsArchitecture, CsProcessors, CsTotalPhysicalMemory, OsTotalVisibleMemorySize, OsFreePhysicalMemory | ConvertTo-Json', true),
('Check Disk Health', 'Runs a quick disk health check using WMIC', 'diagnostics', 'powershell', 'Get-WmiObject -Class Win32_DiskDrive | Select-Object Model, Status, Size, InterfaceType | ConvertTo-Json', true),
('List Running Services', 'Lists all currently running Windows services', 'diagnostics', 'powershell', 'Get-Service | Where-Object { $_.Status -eq "Running" } | Select-Object Name, DisplayName, StartType | Sort-Object DisplayName | ConvertTo-Json', true),
('Windows Update Check', 'Checks for available Windows updates', 'maintenance', 'powershell', '$session = New-Object -ComObject Microsoft.Update.Session; $searcher = $session.CreateUpdateSearcher(); $result = $searcher.Search("IsInstalled=0"); Write-Output "Found $($result.Updates.Count) available updates"; $result.Updates | ForEach-Object { Write-Output "- $($_.Title)" }', true),
('Repair Windows Image', 'Runs DISM to repair the Windows image (requires admin, may take 10-15 min)', 'maintenance', 'powershell', 'Write-Output "Starting DISM health check..."; DISM /Online /Cleanup-Image /CheckHealth; Write-Output "Starting DISM restore health..."; DISM /Online /Cleanup-Image /RestoreHealth /LimitAccess; Write-Output "DISM completed"', true),
('System File Checker', 'Runs sfc /scannow to check and repair system files', 'maintenance', 'powershell', 'Write-Output "Running System File Checker..."; sfc /scannow; Write-Output "SFC completed"', true),
('Get Installed Updates', 'Lists recently installed Windows updates', 'diagnostics', 'powershell', 'Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 20 HotFixID, Description, InstalledOn | ConvertTo-Json', true),
('Test Internet Connectivity', 'Tests connectivity to common endpoints', 'networking', 'powershell', '$targets = @("8.8.8.8", "1.1.1.1", "google.com", "microsoft.com"); foreach ($t in $targets) { $result = Test-Connection -ComputerName $t -Count 2 -Quiet -ErrorAction SilentlyContinue; Write-Output "$t : $(if($result){''OK''}else{''FAILED''})" }', true),
('Export System Event Errors', 'Gets recent error events from the System log', 'diagnostics', 'powershell', 'Get-WinEvent -FilterHashtable @{LogName="System";Level=1,2;StartTime=(Get-Date).AddDays(-7)} -MaxEvents 50 -ErrorAction SilentlyContinue | Select-Object TimeCreated,Id,ProviderName,Message | ConvertTo-Json', true),
('Disable Cortana', 'Disables Cortana via registry', 'configuration', 'powershell', 'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" /v AllowCortana /t REG_DWORD /d 0 /f; Write-Output "Cortana disabled"', true),
('Enable Remote Desktop', 'Enables Remote Desktop and firewall rule', 'configuration', 'powershell', 'Set-ItemProperty -Path "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server" -Name "fDenyTSConnections" -Value 0; Enable-NetFirewallRule -DisplayGroup "Remote Desktop"; Write-Output "Remote Desktop enabled"', true),
('Get Active Network Connections', 'Lists active TCP connections', 'networking', 'powershell', 'Get-NetTCPConnection -State Established | Select-Object LocalAddress,LocalPort,RemoteAddress,RemotePort,OwningProcess,@{N="Process";E={(Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName}} | ConvertTo-Json', true),
('Clear Windows Update Cache', 'Stops Windows Update, clears cache, restarts service', 'maintenance', 'powershell', 'Stop-Service -Name wuauserv -Force; Remove-Item -Path "C:\\Windows\\SoftwareDistribution\\Download\\*" -Recurse -Force; Start-Service -Name wuauserv; Write-Output "Windows Update cache cleared"', true),
('Check RAM Details', 'Shows detailed RAM module information', 'diagnostics', 'powershell', 'Get-WmiObject Win32_PhysicalMemory | Select-Object BankLabel,DeviceLocator,Capacity,Speed,Manufacturer,PartNumber | ConvertTo-Json', true),
('Power Plan Settings', 'Shows current power plan configuration', 'diagnostics', 'powershell', 'powercfg /list; Write-Output "---"; powercfg /query SCHEME_CURRENT SUB_NONE', true),
('Restart Windows Explorer', 'Kills and restarts explorer.exe to fix UI glitches', 'troubleshooting', 'powershell', 'Stop-Process -Name explorer -Force; Start-Sleep -Seconds 2; Start-Process explorer; Write-Output "Explorer restarted"', true)
ON CONFLICT DO NOTHING;
