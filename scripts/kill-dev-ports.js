const { execSync } = require('child_process');

const ports = [3000, 3001];

function killOnWindows(port) {
  const output = execSync(`netstat -ano -p tcp | findstr :${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid)) pids.add(pid);
  }
  for (const pid of pids) {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    process.stdout.write(`killed port ${port} pid ${pid}\n`);
  }
}

function killOnUnix(port) {
  const output = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const pids = new Set(output.split(/\r?\n/).filter(Boolean));
  for (const pid of pids) {
    execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    process.stdout.write(`killed port ${port} pid ${pid}\n`);
  }
}

for (const port of ports) {
  try {
    if (process.platform === 'win32') killOnWindows(port);
    else killOnUnix(port);
  } catch {
    process.stdout.write(`port ${port} already clear\n`);
  }
}
