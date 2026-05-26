// build-agent-zip.mjs — run with: node scripts/build-agent-zip.mjs
// Produces: apps/api/public/ResolvAgent.zip
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import archiver from 'archiver';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const AGENT_DIR = resolve(ROOT, 'apps/agent/node-agent');
const OUT_DIR = resolve(ROOT, 'apps/api/public');
const OUT_FILE = join(OUT_DIR, 'ResolvAgent.zip');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const output = createWriteStream(OUT_FILE);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`ResolvAgent.zip created: ${archive.pointer()} bytes → ${OUT_FILE}`);
});
archive.on('error', (err) => { throw err; });

archive.pipe(output);
archive.directory(AGENT_DIR, 'ResolvAgent');
archive.finalize();
