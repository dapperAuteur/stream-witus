## ⚠️ Ecosystem repo identity (don't confuse these)

This repo — **stream-witus** — is **Stream.WitUS** (stream.witus.online): a personal-first
cross-media tracker and companion for the **All The Spoilers** podcast (books / movies / TV), plus
the **ReadWitUS** book club. Don't confuse it with the other WitUS apps — in particular it is
**not** the CentenarianOS "media tracker" module it was extracted from, and not `witus-learn` (the
LMS extracted from the same parent). Full ecosystem identity + product index: `gemini/witus/CLAUDE.md`.


> **This repo is currently a build brief, not yet an app.** It contains docs + plans and no
> application code. After reading this file, read `docs/02-build-plan.md`, then `docs/03-data-model.md`,
> `docs/04-extraction-map.md`, and `docs/05-ecosystem-integration.md` before scaffolding. **Answer the
> five open product decisions in `docs/06-open-decisions.md` first.** Raw research provenance is in
> `docs/reports/`. The origin plan is `plans/01-extract-media-tracker-into-stream-witus.md`.

## The one job

Track what BAM reads / watches / listens to, tie each title to the **All The Spoilers** episode that
covers it, and run the **ReadWitUS** book club — **with spoilers as a first-class, progress-gated
feature.** If a feature belongs to another platform's job, it is not built here. The signature angle:
nobody else links a book to its screen adaptations, gates spoilers by *your* (or the club's) progress,
and ties podcast episodes to the titles they cover. Preserve that triad; don't dilute the app into a
generic Letterboxd/Goodreads clone.

## The load-bearing invariant — owner-scoped now, public-ready later

Audience for v1 is **personal + public-ready**: build BAM's tools first, but architect so opening to
public sign-ups is *additive*, not a rewrite.

- Every content query goes through an owner-scoped data-access layer (a `src/db/scoped.ts`-style
  chokepoint), scoped by `user_id` today. **No route handler may run an unscoped read.** List queries
  filter `user_id`; by-id / by-slug reads **404 across owners** (never redirect — a redirect leaks
  existence).
- Write the scoped layer so a later `visibility=public` / public-profile / multi-user dimension is an
  *additive* parameter, not a refactor. This mirrors `witus-learn`'s tenant-isolation rule, dialed to
  "owner-scoped now, multi-user later."
- An **isolation test suite** (build Phase 2) is the first hard gate: any cross-owner leak fails the
  build, exactly as in witus-learn.

## Stack & conventions (mirror `witus-learn` / `shop-witus`)

Next.js 16 App Router (`--webpack`) · TS · Tailwind v4 · `@neondatabase/serverless` + Drizzle ORM +
drizzle-kit · Better Auth 1.6.2 (magic-link) · Zod 4 · Vitest · `tsx` scripts · pnpm. Plus Cloudinary
(covers/audio), TMDB + Open Library (metadata), and the witus-outbox/-inbox sender libraries. `@/*` →
`src/*`. Lazy Proxy-wrapped DB client; env validated in `src/lib/env.ts`; schema split under
`src/db/schema/`, Drizzle-generated migrations + hand-written SQL for the Postgres-specific bits
(checks, triggers). One Neon instance for this app (no shared DBs across the ecosystem).

---

<!-- BEGIN:witus-shared-rules v1 -->
<!-- MANAGED BLOCK — do not edit by hand. Source: gemini/witus/docs/shared-rules.md.
     Update the source, then run `node scripts/sync-claude-rules.mjs` in the witus repo. -->

## ⚠️ Ecosystem identity (shared note — don't confuse repos)

Full ecosystem identity + the canonical product index live in `gemini/witus/CLAUDE.md` and
`gemini/witus/lib/products.ts`. Each repo states *which* product it is in its own hand-owned line
above this managed block; don't infer another app's URLs, routes, IDs, env names, or DB schema —
confirm against that app's own code.

The site **brandanthonymcdonald.com** (BAM's personal portfolio) lives in `claude/bam-landing-page/`
— **NOT** `projects/bam-portfolio/` (the retired legacy static site). Target `bam-landing-page`.

## Operator-task rule — capture user actions in `./plans/user-tasks/`

When Claude proposes work that needs BAM to do something outside the editor (account signup, API
key, DNS change, vendor dashboard, env-var rotation, secret generation, PR review/merge, etc.),
Claude MUST create a `./plans/user-tasks/NN-slug.md` file in this repo. **No exceptions for "small"
steps.** Required sections: **Scope tag** · **What + why** (with explicit *what this blocks* detail
and any hard deadline) · **Steps** · **What Claude will use** · **How to mark done** · **Related**.
Keep `./plans/user-tasks/00-descriptions.md` updated with columns `# | Title | Scope | Blocks |
Status` — the `Blocks` column is the one BAM scans. Ecosystem-wide tasks (Keap, IRL events, retros,
cross-product decisions) live in the canonical witus queue at `gemini/witus/plans/user-tasks/`;
repo-local tasks live here. Read the witus queue at session start before dependent work. Full rule:
`gemini/witus/CLAUDE.md` §"Operator-task rule".

## Branch hygiene — BAM merges, between sessions by default

**Half 1.** Branch → commit → push → stop. Claude does not run `git checkout main && git merge`.
Never `--force` to shared branches. Before every commit run `git branch --show-current`; if it is
`main`/`master`, branch first (`feat/ fix/ chore/ docs/`). After push, hand back the branch name +
summary and stop.

**Half 2.** BAM merges pushed branches via the GitHub UI between sessions. Mid-session, after a
push, BAM may merge in a separate window and the local checkout silently fast-forwards to `main` —
so re-check `git branch --show-current` before **every** commit, not just at branch creation, or you
risk landing follow-up commits directly on `main`.

**Half 3.** Keep branches small (one concern each). When a session produces multiple branches,
consolidate them into one `bundle/<slug>-YYYY-MM-DD` via `git merge --no-ff` (preserves per-concern
history — no squash), resolve conflicts during bundling, run `tsc + lint + build` against the
bundle, push, and file ONE `./plans/user-tasks/NN-merge-bundle-<slug>.md`. BAM does one merge, not N.

**Commit often.** Commit at every working checkpoint — a passing build, a finished sub-step, a green
test — not just at the end. A usage-limit cutoff, a dropped connection, or a crashed session must
never lose more than the last few minutes of work. Small frequent commits on the feature branch keep
the branch un-merged (Half 1 still holds) and give BAM clean per-step history to drill into.

A checked-in `.githooks/pre-commit` guard refuses commits made directly on `main`/`master`. Activate
once per clone: `git config core.hooksPath .githooks`. Full rule: `gemini/witus/CLAUDE.md`
§"Branch-hygiene rule".

## Docs-sync rule — a change isn't done until its docs are current

When a change adds, alters, or removes a user-visible feature/route/scope, update the affected docs
**in the same branch**: README (feature list, env examples, scripts), in-app help/tutorial content,
`ROADMAP.md` **and** any public roadmap page, API/OpenAPI docs, and STYLE_GUIDE/CONTRIBUTING when a
convention changed. State which docs you touched in the handoff. Never leave an aspirational ✅ on a
roadmap — downgrade it with a one-line reason. If a doc update is genuinely out of scope, file it as
a `./plans/` task rather than skipping silently. A Stop hook in `.claude/settings.json` gates on
this: if the session diff changed feature/route files but touched no docs, it blocks once and asks
you to update-or-defer. Schema-only migrations, refactors, perf, and dev-tooling changes don't
trigger it.

## Plans convention

All implementation plans live in `./plans/` as `NN-description-of-plan.md` (two-digit prefix,
kebab-case, next available number, don't skip). Sub-queues: `./plans/user-tasks/NN-slug.md`
(operator tasks), `./plans/bugs/`, `./plans/future/`. (`plans/` is typically gitignored.)

## Citation rule

Anything publishable, teachable, or partner-facing (curriculum, teaching-oriented help articles,
white papers, grant/sponsor/partner writing) uses APA 7 in-line citations with a `## References`
section. Code docs, internal notes, and `plans/user-tasks/*` are out of scope. Full rule:
`gemini/witus/CLAUDE.md` §"Citation rule".

## Authoritative-values rule — never assert guessed external values

When a value is owned by an external system (DNS/registrar, a host like Vercel, a third-party API,
or another ecosystem app's URLs/routes/IDs/env/schema), read it from the authoritative source; don't
hardcode a guessed default and present it as correct. If you must ship a fallback, label it as a
fallback in both UI copy and a code comment. Verify by behavior (does the flow work?), not by
exact-match against a guess. When unsure, flag or ask — never assert. Full rule:
`gemini/witus/CLAUDE.md` §"Authoritative-values rule".

## Coding conventions

UI/UX/DX conventions (a11y, component patterns, TypeScript, microcopy, git-commit vocabulary, the
default Neon+Drizzle+pnpm+Vitest stack) are consolidated in `gemini/witus/docs/shared-ui-ux-dx.md`.
Read it before writing UI or API code. Two repos are grandfathered on Supabase+Jest and documented
there as exceptions.

<!-- END:witus-shared-rules v1 -->
