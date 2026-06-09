// Test agent command execution — runs the exact PowerShell commands the agent uses
import { exec } from 'child_process';

function execCmd(cmd, timeoutMs = 30000) {
  return new Promise((resolve) => {
    console.log(`\n--- Running: ${cmd.substring(0, 120)}...`);
    const start = Date.now();
    exec(cmd, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      shell: 'cmd.exe',
    }, (err, stdout, stderr) => {
      const elapsed = Date.now() - start;
      console.log(`Duration: ${elapsed}ms`);
      console.log(`Exit: ${err ? err.code || 1 : 0}`);
      if (stdout) console.log(`STDOUT: ${stdout.substring(0, 500)}`);
      if (stderr) console.log(`STDERR: ${stderr.substring(0, 500)}`);
      resolve({ success: !err, exit_code: err ? (err.code || 1) : 0, stdout, stderr, elapsed });
    });
  });
}

async function main() {
  // Test 1: Cycle count via PowerShell Get-CimInstance (wmic is removed on Win11 24H2+)
  console.log('\n========== TEST 1: Cycle Count via PowerShell ==========');
  await execCmd('powershell -NoProfile -Command "(Get-CimInstance -Class Win32_Battery).CycleCount"');

  // Test 2: Full battery info via PowerShell
  console.log('\n========== TEST 2: Full Battery via PowerShell ==========');
  await execCmd('powershell -NoProfile -Command "Get-CimInstance -Class Win32_Battery | Select-Object BatteryStatus,DesignCapacity,EstimatedChargeRemaining,CycleCount | ConvertTo-Json"');

  // Test 3: Simple PowerShell script WITHOUT quotes (no escaping needed)
  console.log('\n========== TEST 3: PowerShell simple ==========');
  await execCmd('powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Write-Host Hello-World"');

  // Test 4: PowerShell script WITH double quotes (tests the \" escaping)
  console.log('\n========== TEST 4: PowerShell with quotes ==========');
  const script4 = 'Write-Host \\"Hello, World! The deployment was successful.\\"';
  await execCmd('powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "' + script4 + '"');

  // Test 5: Event log collection (FIXED — no semicolon before pipes)
  console.log('\n========== TEST 5: Event log collection (fixed) ==========');
  const ps5 = '$startDate = (Get-Date).AddHours(-1); ' +
    'Get-WinEvent -FilterHashtable @{LogName="System";Level=2,3;StartTime=$startDate} -MaxEvents 5 -ErrorAction SilentlyContinue ' +
    '| Select-Object TimeCreated,Id,LevelDisplayName,ProviderName,Message ' +
    '| ConvertTo-Json -Compress';
  await execCmd('powershell -NoProfile -Command "' + ps5.replace(/"/g, '\\"') + '"');

  // Test 6: manage-bde status
  console.log('\n========== TEST 6: BitLocker status ==========');
  await execCmd('powershell -NoProfile -NonInteractive -Command "manage-bde -status"');

  // Summary
  console.log('\n========== ALL TESTS COMPLETE ==========');
}

main().catch(console.error);
