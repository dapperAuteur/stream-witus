# Stream.WitUS

**stream.witus.online** — a personal-first cross-media tracker and companion for the **All The
Spoilers** podcast (books / movies / TV), plus the **ReadWitUS** book club, with **spoilers as a
progress-gated, first-class feature**. Extracted from the CentenarianOS media tracker and rebuilt on
the WitUS ecosystem stack (mirrors `witus-learn`).

> Build status: **Phases 0–6 landed** (scaffold · foundation · isolation gate · tracker UI ·
> auto-metadata · public podcast surface · ReadWitUS book club). Ecosystem wiring (outbox/inbox) and
> public-ready hardening follow — see the roadmap.

## Stack

Next.js 16 (App Router, `--webpack`) · TypeScript · Tailwind v4 · Neon Postgres + Drizzle ORM +
drizzle-kit · Better Auth (magic-link via Mailgun) · Zod · Vitest · pnpm · Cloudinary · TMDB +
Open Library. `@/*` → `src/*`.

## Architecture

- **Owner-scoped data access** — every owner content query goes through the `src/db/scoped.ts`
  `ScopedDb` chokepoint, scoped by `user_id`. No route handler runs an unscoped read; by-id reads
  return null (caller 404s) across owners — never a redirect.
- **Public read path** — logged-out reads (public show notes at `/episodes`, public clubs at
  `/clubs/[slug]`) go through the separate `src/db/public.ts` chokepoint, which filters
  `visibility = 'public'` and never returns a private row. The additive multi-user dimension the
  owner-scoped design anticipated.
- **Membership-scoped clubs** — `src/db/clubs.ts` scopes ReadWitUS club content by membership, and
  enforces the spoiler-safe gate: a discussion post tied to milestone N is returned with its **body
  withheld** to members below N (the spoiler never crosses the wire), not merely CSS-blurred.
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

## Using the app (Phase 3)

Sign in at `/signin` (magic link — until Mailgun is configured, the link is printed to the dev server
console). After sign-in you land on `/dashboard/media`: add/edit/list/detail media items, write notes
(incl. spoilers, with optional audio), link adaptations/relationships, manage creators & platforms
(`/dashboard/media/settings`), plan podcast episodes and link discussed titles
(`/dashboard/media/podcasts`), **Find** a title via Open Library / TMDB to auto-fill details,
import from a URL, and export CSV. Every `/dashboard` route is owner-gated (redirects to `/signin`).

## API surface

Ported from CentenarianOS, rewritten Supabase → Drizzle through `ScopedDb`, auth swapped to Better
Auth, with the CentOS request/response contract preserved so the UI ports unchanged:
`media` (list/create) · `media/[id]` · `media/[id]/notes[/{noteId}]` · `media/[id]/relationships` ·
`media/categories[/{id}]` · `media/creators[/{id}]` · `media/platforms[/{id}]` · `media/export` ·
`media/import` · `media/import-url` · `media/lookup` (Open Library / TMDB auto-metadata) ·
`media/summary` · `podcasts` (list/create) · `podcasts/[id]` (get/patch/delete) ·
`podcasts/[id]/media` (link / update-timestamp / unlink).

ReadWitUS clubs (`/dashboard/clubs`): `clubs` (list/create) · `clubs/[id]` (get/patch) ·
`clubs/[id]/members` · `clubs/[id]/reads` · `clubs/[id]/reads/[readId]/{schedule,progress,discussion}`.

Public, logged-out surfaces (read path `src/db/public.ts`): `/episodes` + `/episodes/[id]` (public
show notes) and `/clubs/[slug]` (public club identity + reading list) for content marked
`visibility=public`.

## Project docs

`CLAUDE.md` (ecosystem rules + the one job), `docs/` (vision, build plan, data model, extraction map,
ecosystem integration, resolved decisions), and `plans/` (implementation plans + the operator-task
queue) are local working notes — see those for the full build context.
