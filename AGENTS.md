# Resolv — Agentic Coding Guide

## Project Overview

IT service management platform. Monorepo (npm workspaces: `apps/*`, `packages/*`).

- `apps/api` — **Fastify 5** backend (TypeScript, CommonJS, ts-node-dev). Entry: `src/index.ts`
- `apps/web` — Next.js 16 App Router (React 19, Tailwind 4, Zustand 5, Socket.IO client)
- `apps/agent` — Two independent sub-implementations (not in npm workspaces):
  - `apps/agent/node-agent/` — Plain Node.js Windows service; built to `.exe` via `pkg`. Entry: `agent.js`
  - `apps/agent/` — Electron wrapper; `electron-builder` for NSIS installer
- `apps/agent-windows` — C# alternative (not the active build path)
- `packages/shared` — Referenced in API tsconfig via `../../packages/shared/src/index.ts` path mapping, but **the `packages/` directory does not currently exist**. Import as `@resolv/shared`; you may need to recreate it.

## Commands

```bash
# Root — kill-dev-ports runs first on predev, then runs web+api in parallel
npm run dev            # concurrently dev:web + dev:api
npm run build          # build:web && build:api && build:agent-api

# API (apps/api — or via root shortcut)
npm run dev:api        # ts-node-dev --respawn --transpile-only src/index.ts
npm run build          # tsc
npm run start          # node dist/index.js

# Web (apps/web — or via root shortcut)
npm run dev:web        # next dev
npm run build          # next build
npm run lint           # eslint (flat config: eslint.config.mjs)
ANALYZE=true npm run build  # bundle analyzer (uses @next/bundle-analyzer)

# node-agent (apps/agent/node-agent — manage independently, NOT in npm workspaces)
npm run build          # bundle-nssm → pkg agent.js → dist/ResolvAgent.exe (node18-win-x64)
npm run start          # node agent.js (local run, no service install)

# Electron agent (apps/agent — also independent)
npm run build          # tsc
npm run package        # tsc + electron-builder → NSIS installer
```

## DB Setup & Migrations

All scripts in `apps/api/src/db/`. Pool singleton at `src/db/pool.ts`.

```bash
# From apps/api:
node src/db/run_schema.js    # create schema (run on fresh DB)
node src/db/run_seed.js      # seed initial data
node src/db/run_migration.js # run incremental migrations (apply .sql files)
```

Required env vars (copy `apps/api/.env.example` → `apps/api/.env`):
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/resolv
JWT_SECRET=<long-random-string>
PORT=3001
WEB_URL=http://localhost:3000
HOST=0.0.0.0
NODE_ENV=production
```

## Testing

No test framework — no jest/playwright config. Root has standalone test scripts:
`test-ai-realistic.mjs`, `test-multi-turn.mjs`, `test-no-duplicate.mjs`, `test-ai-tools.mjs`

Prefer `node --test` or new standalone scripts.

## Agent Deployment (Windows)

The active path is `apps/agent/node-agent/` → `dist/ResolvAgent.exe`, installed via NSSM as a Windows service.

```powershell
.\deploy.ps1   # stop service, replace exe, restart
```

`apps/agent/node-agent/config.json` holds `serverUrl`, `agentSecret`, `assetId`, `agentToken`.
**Do not commit real tokens.** The file is gitignored (`apps/agent/node-agent/config.json` in `.gitignore`) but verify.

## Code Style (Repo-Specific)

### Imports
- External deps first, blank line, then internal imports
- `@/` path alias in web (`import { x } from '@/lib/store'`); relative paths in api
- Shared types: `import { UserRole } from '@resolv/shared'`

### Patterns
- **API routes**: default export, `fastify.get|post|patch|delete`, `zod` `.parse()` on body/query/params
- **Auth preHandlers**: `{ preHandler: [fastify.authenticate] }` for any auth; `[fastify.requireRole(['admin'])]` for role-gated; `[fastify.requirePermission('manage_users')]` for permission-gated
- **DB queries**: parameterized `$1, $2, ...` always — never string interpolation
- **Dynamic WHERE**: `let paramIdx = 1` pattern appending `$${paramIdx++}` per condition
- **Transactions**: `client.query('BEGIN')` / `COMMIT` / `ROLLBACK` with `finally { client.release() }`
- **Fire-and-forget**: `.catch(console.error)` or `.catch(() => {})` — never leave promises unhandled
- **Comment edit**: own comment within 15 min, or admin/agent any time (`tickets.ts:822-847`)
- **Sockets**: `fastify.io` (decorated instance). Rooms: `ticket:$id`, `user:$userId`, `asset:$assetId`. Events: `ticket:created`, `ticket:updated`, `ticket:comment:$id`, `notification:new`, `ticket:presence`, `ticket:typing`
- **Presence tracking**: `ticketPresence: Record<string, Set<string>>` in-memory on `index.ts` (not persisted)

### Web
- `'use client'` on all interactive components; default export for pages
- Zustand `useStore` for global state; local `useState` for UI state
- `api.get<T>()` / `api.post<T>()` — fetch wrapper with auto-auth, 30s timeout, auto-refresh on 401, retry 502/503/504 once
- Token persisted to **sessionStorage** (`resolv_access_token`), not localStorage (survives reload, not browser close)
- Inline `style={}` objects (no CSS modules); `className` only for animations/keyframes
- Error boundaries at app segment level via `error.tsx`
- Security headers set in `next.config.ts`: X-Frame-Options DENY, X-Content-Type-Options nosniff, Permissions-Policy restricting camera/mic/geo
- `@tailwindcss/postcss` plugin (Tailwind 4) — no legacy PostCSS config needed

### DB Schema
- Column names are `snake_case` (JSON responses too); web types use `camelCase`
- Enum-like columns: `status`, `priority`, `role`, `ticket_type` as varchar strings (not PG enums)
- Error codes: ZodError → 400, `23505` (unique violation) → 409, unexpected → 500

### Other
- `.gitignore` already covers: `node_modules`, `dist`, `.next`, `.env*`, `*.log`, `config.json`
- No commit conventions enforced; descriptive imperative messages preferred
