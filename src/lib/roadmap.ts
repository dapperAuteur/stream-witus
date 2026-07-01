// Committed snapshot of the roadmap for the in-app admin view (plans/future/01).
// The detailed working roadmap stays in docs/ROADMAP.md (gitignored); keep this
// concise summary in sync when phases land.
export const ROADMAP_MD = `# Stream.WitUS roadmap

## ✅ Shipped
- **Phases 0–8** — scaffold · foundation · owner-scoped isolation gate · media tracker UI ·
  auto-metadata (Open Library + TMDB) · public podcast surface · ReadWitUS book club (spoiler-safe,
  progress-gated) · outbox/inbox wiring · public-ready hardening (profile shelf, RSS, sitemap, robots).
- **Invite-only signup** + waitlist + owner admin.
- **Podcast publishing** absorbed from witus.online — multi-show (\`podcast_shows\`), Disctopia import,
  per-show outbox publishing.
- **Admin dashboard** — stats · health · audit log · outbox control · inbox triage · **role tiers**
  (owner/admin/moderator/monitor + deactivate) · members · feature flags · moderation (episode
  unpublish, feature a public club, discussion-post takedown).
- **Sign in with WitUS** (ecosystem OIDC client).
- **Admin roadmap route** + role/capability tests.
- **Canonical iTunes-spec podcast feed** — generated per show at
  \`/feed/podcast/<slug>/rss.xml\` (audio enclosures + channel config in admin). Feed generation done;
  the Apple/Spotify **cutover** is an operator step (task 16).

## ⏳ Operator (no code left)
- Run prod migrations; per-show outbox env + Disctopia re-import (WFC/AAMSAZ) — task 15.
- Set each show's channel config, validate feeds, then coordinate the podcast cutover — task 16.
`;
