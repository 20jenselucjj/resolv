// copy-agent-exe.js — run with: node scripts/copy-agent-exe.js
// Copies the compiled ResolvAgent.exe into the API's uploads directory
// so the download endpoint can find it in production.
const { copyFileSync, existsSync, mkdirSync } = require('fs');
const { resolve, join, dirname } = require('path');

const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'apps/agent/node-agent/dist/ResolvAgent.exe');
const DST = resolve(ROOT, 'apps/api/uploads/agent/ResolvAgent.exe');

if (!existsSync(SRC)) {
  console.log('[copy-agent-exe] Agent binary not found at:', SRC);
  console.log('[copy-agent-exe] Skipping copy. Build the agent first with: cd apps/agent/node-agent && npm run build');
  process.exit(0);
}

mkdirSync(dirname(DST), { recursive: true });
copyFileSync(SRC, DST);
console.log(`[copy-agent-exe] Copied ResolvAgent.exe → ${DST}`);
