# Stream.WitUS — build brief

**This folder is a handoff package, not yet an app.** It holds the docs + plans needed to build
**Stream.WitUS** (stream.witus.online): a personal-first cross-media tracker and companion for the
**All The Spoilers** podcast (books / movies / TV), plus the **ReadWitUS** book club. It was produced
in a planning session by extracting and re-scoping the media-tracker module from **CentenarianOS**
(`gemini/centenarian-os/app/dashboard/media`), following the same path the Academy module took to
become **LearnWitUS** (`claude/witus-learn`).

There is **no application code here** — the build happens in a separate session that opens this folder.

## Reading order (for the build chat)

1. **`CLAUDE.md`** — ecosystem rules + this product's "one job" and the owner-scoped→public-ready
   invariant. Read first.
2. **`docs/06-open-decisions.md`** — the **5 open product decisions**. Answer these before scaffolding;
   they change the schema and scope.
3. **`docs/00-vision-and-one-job.md`** — product thesis and positioning.
4. **`docs/01-competitive-brief.md`** — what the leaders do well and the gaps we exploit (APA 7).
5. **`docs/02-build-plan.md`** — the phased build (scaffold → foundation → isolation gate → features →
   ecosystem wiring → public-ready).
6. **`docs/03-data-model.md`** — the target Drizzle schema (8 CentOS tables translated + a new
   ReadWitUS `club.ts` group).
7. **`docs/04-extraction-map.md`** — what to port ~as-is vs rewrite, file-by-file from CentOS.
8. **`docs/05-ecosystem-integration.md`** — inbox + outbox wiring with exact contracts.
9. **`docs/reports/A,B,C`** — the raw research reports behind the synthesized docs (verbatim).
10. **`plans/`** — the origin plan + the operator-task queue (`plans/user-tasks/`).

## To start the build

1. `git init` this folder (or move it into a fresh repo), then activate the branch-hygiene hook:
   `git config core.hooksPath .githooks`.
2. Work the operator tasks in `plans/user-tasks/` (Neon, DNS, TMDB key, outbox/inbox slugs) — they
   unblock the phases.
3. Follow `docs/02-build-plan.md`. Phase 2 (the isolation test suite) is the first hard gate.

## Ecosystem stack (target)

Next.js 16 · TypeScript · Tailwind v4 · Neon Postgres + Drizzle ORM · Better Auth (magic-link) · Zod ·
Vitest · pnpm · Cloudinary · TMDB + Open Library · witus-outbox / witus-inbox sender libs. Mirrors
`witus-learn` / `shop-witus`.
# stream-witus
