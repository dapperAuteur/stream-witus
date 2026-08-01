# Stream.WitUS

**stream.witus.online** — a personal-first cross-media tracker and companion for the **All The
Spoilers** podcast (books / movies / TV), plus the **ReadWitUS** book club, with **spoilers as a
progress-gated, first-class feature**. Extracted from the CentenarianOS media tracker and rebuilt on
the WitUS ecosystem stack (mirrors `witus-learn`).

> Build status: **the full 8-phase build is complete** (scaffold · foundation · isolation gate ·
> tracker UI · auto-metadata · public podcast surface · ReadWitUS book club · outbox/inbox wiring ·
> public-ready hardening), plus invite-only signup + an owner admin dashboard. Post-v1 ideas live in
> `plans/future/`. Inbox still needs its `stream-witus` source provisioned (task 07).

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
- **Error monitoring** via `@sentry/nextjs` on all three runtimes (server, edge, browser), pointed at
  **Better Stack** (it ingests the standard Sentry SDK, so the vendor is one env var). Guarded on the
  DSN: with `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` unset the SDK never initialises and nothing is
  sent. A `beforeSend` scrubber (`src/lib/sentry-scrub.ts`, tested in `tests/sentry-scrub.test.ts`)
  strips emails, cookies, auth headers, JWTs, the TMDB `?api_key=`, Cloudinary signed-delivery URLs
  and signed podcast media URLs before an event leaves the app, while keeping UUID resource URLs so a
  report is still triageable.
- **Uptime probe** at `GET /api/health` (see below): the one route that proves the database is
  reachable, so a green uptime check means something.
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
| `pnpm test` | Vitest (isolation suite + the error-report scrubber) |
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

Public, logged-out surfaces (read path `src/db/public.ts`): `/episodes` + `/episodes/[id]` (show
notes), `/clubs/[slug]` (club identity + reading list), `/shelf` (the owner's public media), the
`/connect` + `/pitch` forms, RSS at `/feed/episodes.xml` + `/feed/shelf.xml`, plus `/sitemap.xml` and
`/robots.txt`. Everything here surfaces only `visibility=public` (or approved) content.

## Health check (point uptime monitors here, not at `/`)

`GET /api/health` is public, unauthenticated and never cached (`force-dynamic`, `revalidate = 0`,
`Cache-Control: no-store`). `HEAD /api/health` returns the same status with no body, for monitors
that prefer it.

| Result | Status | Body |
|---|---|---|
| Database reachable | `200` | `{"ok":true,"service":"stream-witus"}` |
| Database unreachable, or slower than 4s | `503` | `{"ok":false,"error":"dependency_unavailable"}` |

**Point Better Stack (and any other uptime monitor) at `/api/health`, not at `/`.** The homepage can
return `200` from a cached or static render while Neon is down, so a green check on `/` can mean
nothing. This route runs the cheapest possible liveness query (`select 1`, `src/db/health.ts`), with
a 4-second timeout past which a hung database counts as down.

What it deliberately does **not** do:

- **It calls no third-party API**: no metadata provider, no media/streaming host, no player embed.
  A vendor outage must not turn this app's uptime monitor red, and provider errors routinely carry
  API keys and signed media URLs.
- **It reports nothing about internals**: not which providers are configured, not whether any key is
  valid, not stream or feed state. The two response bodies above are fixed literals; the failure token
  names no dependency and no cause.
- **It never echoes an error.** The failure path swallows the exception unread (driver errors can
  embed the connection string) and logs a single constant string, `[health] dependency check failed`.
  Diagnosis comes from Better Stack error monitoring, not from this public body.

## Project docs

`CLAUDE.md` (ecosystem rules + the one job), `docs/` (vision, build plan, data model, extraction map,
ecosystem integration, resolved decisions), and `plans/` (implementation plans + the operator-task
queue) are local working notes — see those for the full build context.
