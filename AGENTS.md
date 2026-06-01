# Resolv — Agentic Coding Guide

## Project Overview

Monorepo (npm workspaces: `apps/*`, `packages/*`). IT service management platform.

- `apps/api` — Fastify 4 backend (TypeScript, CommonJS, ts-node-dev). Entry: `src/index.ts`
- `apps/web` — Next.js 16 App Router frontend (React 19, TypeScript, Tailwind 4)
- `apps/agent` — **Two sub-implementations** (not in npm workspaces, managed independently):
  - `apps/agent/node-agent/` — Plain Node.js Windows service agent; built to `.exe` via `pkg`. Entry: `agent.js`
  - `apps/agent/` — Electron wrapper (separate; uses `electron-builder` for NSIS installer)
- `apps/agent-windows` — C# `ResolvAgent.csproj` alternative Windows agent (not the active build path)
- `packages/shared` — Shared types/enums/interfaces (`@resolv/shared`)

## Build / Dev Commands

```bash
# Root (from repo root — kills ports 3000/3001 first via predev hook, then runs both in parallel)
npm run dev            # concurrently: dev:web + dev:api
npm run build          # build:web then build:api (sequential)

# API (apps/api) — or via root shortcut
npm run dev:api        # ts-node-dev --respawn --transpile-only src/index.ts
npm run build          # (in apps/api) tsc

# Web (apps/web) — or via root shortcut
npm run dev:web        # next dev
npm run build          # (in apps/web) next build
npm run lint           # eslint (Flat config: eslint.config.mjs)

# node-agent (apps/agent/node-agent — NOT in npm workspaces; manage independently)
npm run build          # bundles nssm then: pkg agent.js → dist/ResolvAgent.exe (node18-win-x64)
npm run start          # node agent.js (local run, no service install)

# Electron agent (apps/agent — also NOT in npm workspaces)
npm run build          # tsc
npm run package        # tsc + electron-builder → NSIS installer
```

**`npm run dev` auto-kills ports 3000 and 3001 before starting** (`predev` hook via `scripts/kill-dev-ports.js`). If you start web/api individually, kill those ports manually first or you'll get EADDRINUSE.

**No test framework or test files exist.** Prefer `node --test` or standalone scripts. No jest/playwright config.

## DB Setup & Migrations

All migration scripts live in `apps/api/src/db/` and run against the pool in `src/db/pool.ts`.

```bash
# From apps/api:
node src/db/run_schema.js    # create schema (idempotent-ish; run on fresh DB)
node src/db/run_seed.js      # seed initial data
node src/db/run_migration.js # run incremental migrations (e.g. migrate_users_sessions.sql)
```

Required env vars (copy `.env.example` → `.env` in `apps/api`):
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/resolv
JWT_SECRET=...
PORT=3001
WEB_URL=http://localhost:3000
```

## Agent Deployment (Windows)

The active production path is `apps/agent/node-agent/` → `dist/ResolvAgent.exe`, installed as a Windows service via NSSM.

```powershell
# deploy.ps1 (repo root) — stop service, replace exe, restart
.\deploy.ps1
```

`apps/agent/node-agent/config.json` holds `serverUrl`, `agentSecret`, `assetId`, `agentToken`. **Do not commit real tokens.** The file is not gitignored by default — verify before committing.

## Code Style Guidelines

### Imports
- External dependencies first, then a blank line, then internal imports
- Named imports preferred; default imports for fastify plugins and route modules
- Use `@/` path alias in web (`import { x } from '@/lib/store'`); use relative paths in api (`import { pool } from '../db/pool'`)
- Shared types: `import { UserRole } from '@resolv/shared'`

### Formatting
- 2-space indentation, single quotes, semicolons required
- No trailing commas in object/array literals
- Line length: soft limit ~100 chars
- One empty line between top-level blocks (function declarations, route registrations)

### Types
- `interface` for objects/API responses, `type` for unions (`type TicketStatus = 'open' | 'closed'`)
- `zod` schemas for all request validation (`.parse()` on body/query/params); schema objects defined as `const schemaName = z.object({...})`
- Use `Record<string, T>` for dynamic key objects; `any` only as last resort (router params/legacy)
- Explicit return type annotations on function components (`{ children: React.ReactNode }`) and API handlers
- `declare module 'fastify'` for Fastify instance augmentation
- `JwtPayload` interface for decoded JWT user info; cast with `request.user as JwtPayload`

### Naming
- `camelCase` for variables, functions, file exports
- `PascalCase` for interfaces, types, enums, React/Next components
- `kebab-case` for filenames (e.g., `directory-sync.ts`, `notifications.ts`); exceptions for single-word files
- `UPPER_SNAKE_CASE` for constants (`MAX_ATTEMPTS`, `WINDOW_MS`)
- `snake_case` for database column names and JSON API response fields
- Routes: plural nouns (`/tickets`, `/users`, `/knowledge`)

### React / Next.js Patterns
- `'use client'` directive at top of all interactive components
- Function components with named exports; default export for pages
- Inline `style={}` objects (no CSS modules); `className` only for animations/keyframes
- Zustand store (`useStore`) for global state; local `useState` for UI state
- `useEffect` for side effects (auth checks, socket setup, keyboard shortcuts)
- `api.get<T>()` / `api.post<T>()` for data fetching (wraps `fetch` with auth headers)
- Error boundaries: `error.tsx` files at app segment level

### API Route Patterns
```typescript
export default async function routeName(fastify: FastifyInstance) {
  fastify.get('/path', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = schema.parse(request.body);
    const result = await pool.query('SELECT * FROM table WHERE id = $1', [id]);
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ data: result.rows[0] });
  });
}
```
- Auth: `{ preHandler: [fastify.authenticate] }` for any auth, `{ preHandler: [fastify.requireRole(['admin'])] }` for role-gated
- All DB queries use parameterized `$1, $2, ...` placeholders — NEVER string interpolation
- Transactions: `const client = await pool.connect()` then `client.query('BEGIN')` / `COMMIT` / `ROLLBACK` with `finally { client.release() }`
- ZodError caught by global error handler → 400; `23505` (unique violation) → 409

### Error Handling
- API: structured `{ error: string }` responses; global `setErrorHandler` in `src/index.ts` catches ZodError (400), unique violations (409), and unexpected (500)
- Web: `api.ts` auto-retries 502/503/504 once, maps status codes to friendly messages, throws `Error` with `.status` property
- Async handlers: rely on Fastify's automatic error forwarding; only `try/catch` when you need to transform/handle specific errors
- Always catch promise rejections in fire-and-forget calls `.catch(console.error)` or `.catch(() => {})`

### DB & Schema
- PostgreSQL via `pg.Pool` (singleton from `src/db/pool.ts`);
- Dynamic `WHERE` clauses use `let paramIdx = 1` pattern, appending `$${paramIdx++}` for each condition
- Enum-like columns: `status`, `priority`, `role`, `ticket_type` as varchar/strings (not PG enums)

### Real-Time / Socket.IO
- Socket.IO server attached to `fastify.io` (decorated instance)
- Room-based: `ticket:${ticketId}` for per-ticket events, `user:${userId}` for per-user notifications
- Event naming: `ticket:created`, `ticket:updated`, `ticket:comment:${id}`, `notification:new`, `ticket:presence`, `ticket:typing`

### Shared Package (`packages/shared`)
- Defines enums (`UserRole`), types (`TicketStatus`, `TicketPriority`), and interfaces (`User`, `Ticket`, `TicketComment`, `ApiResponse<T>`, `PaginatedResponse<T>`)
- Imported as `@resolv/shared` in both apps

### Git Conventions
- `.gitignore` excludes `node_modules`, `dist`, `.next`, `.env*`, `*.log`, `.tmp.*`, `check_*.mjs`
- No commit conventions enforced; descriptive imperative messages preferred
