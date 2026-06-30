# Stream.WitUS

**stream.witus.online** — a personal-first cross-media tracker and companion for the **All The
Spoilers** podcast (books / movies / TV), plus the **ReadWitUS** book club, with **spoilers as a
progress-gated, first-class feature**. Extracted from the CentenarianOS media tracker and rebuilt on
the WitUS ecosystem stack (mirrors `witus-learn`).

> Build status: **Phases 0–2 landed** (scaffold · foundation · isolation gate). The tracker UI,
> auto-metadata, podcast surface, and ReadWitUS club follow — see the roadmap.

## Stack

Next.js 16 (App Router, `--webpack`) · TypeScript · Tailwind v4 · Neon Postgres + Drizzle ORM +
drizzle-kit · Better Auth (magic-link via Mailgun) · Zod · Vitest · pnpm · Cloudinary · TMDB +
Open Library. `@/*` → `src/*`.

## Architecture

- **Owner-scoped data access** — every content query goes through the `src/db/scoped.ts` `ScopedDb`
  chokepoint, scoped by `user_id`. No route handler runs an unscoped read; by-id reads return null
  (caller 404s) across owners — never a redirect. Built so a later `visibility=public` / multi-user
  read path is an *additive* method, not a rewrite.
- **Isolation gate** — `tests/isolation/` proves no cross-owner leak. `no-unscoped-reads.test.ts`
  fails the build if any API route imports the raw DB client; `scoped.db.test.ts` proves owner B
  cannot read/patch/delete owner A's data (runs once a Neon DB is configured).

## Setup

```bash
pnpm install
cp .env.example .env.local      # fill in the DB URL + auth secret (see operator tasks)
pnpm db:migrate                 # apply src/db/migrations to Neon
pnpm seed                       # default categories + a sample item + a sample episode (dev)
pnpm dev                        # http://localhost:3050
```

Database env vars are **`STORAGE_`-prefixed** in this project (Vercel–Neon integration):
`STORAGE_DATABASE_URL`, `STORAGE_DATABASE_URL_UNPOOLED`. The plain / `POSTGRES_` forms are also
accepted.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server (port 3050) |
| `pnpm build` | Production build (`--webpack`) |
| `pnpm typecheck` | `next typegen && tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (isolation suite) |
| `pnpm db:generate` | Generate a Drizzle migration from the schema |
| `pnpm db:migrate` | Apply migrations to Neon (reads `.env.local`) |
| `pnpm seed` | Seed dev data |

## API surface (Phase 1)

Ported from CentenarianOS, rewritten Supabase → Drizzle through `ScopedDb`, auth swapped to Better
Auth. The `/api/media/*` request/response contract is preserved so the Phase 3 UI ports unchanged:
`media` (list/create) · `media/[id]` · `media/[id]/notes[/{noteId}]` · `media/[id]/relationships` ·
`media/categories[/{id}]` · `media/creators[/{id}]` · `media/platforms[/{id}]` · `media/export` ·
`media/import` · `media/import-url` · `media/summary` · `podcasts/[id]/media`.

## Project docs

`CLAUDE.md` (ecosystem rules + the one job), `docs/` (vision, build plan, data model, extraction map,
ecosystem integration, resolved decisions), and `plans/` (implementation plans + the operator-task
queue) are local working notes — see those for the full build context.
