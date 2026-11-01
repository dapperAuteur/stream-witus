---
app: stream-witus
name: Stream.WitUS
stage: beta
url: https://stream.witus.online
updated: 2026-10-31
---

## Live now
- Media tracker for books, TV, movies, music, podcasts and more: status, ratings, progress, season and episode, notes, relationships
- Title lookup that fills in cover, creator and year (Open Library for books; TMDB for movies and TV when its key is set, task 05)
- CSV import and export on the media page, duplicate-safe on re-import, reading CentenarianOS exports (task 22)
- The new home for CentenarianOS's retired Media tracker: CentOS users download their list there and import it here (CentOS plan 49, Stage 1)
- All The Spoilers companion: podcast episodes linked to the titles they discuss, with timestamps and show notes
- Podcast publishing moved here from witus.online: several shows, Disctopia import with a daily cron, per-show outbox drafts on publish
- ReadWitUS book club: members, reading schedule, progress, and a spoiler gate that withholds posts past your milestone
- Public pages: the owner's shelf, episode show notes, public clubs, RSS feeds, sitemap
- Outbox drafts for finished media, published episodes and club reads; contact and pitch forms through the inbox
- Invite-only sign-up with a waitlist; admin dashboard with roles, members, moderation, feature flags, audit log, outbox and inbox panels
- Sign in with WitUS, "Continue as" on the sign-in page, and the choice to sign out of Stream only or of WitUS everywhere
- `/api/health` endpoint that checks the database

## In progress
- Receiving CentenarianOS media lists: hand check of a production export and import (witus task 146)

## Backlog
- Per-user public profiles (the shelf is single-owner today)
- A documented JSON read API alongside the RSS feeds
- Outbox and inbox trigger refinements (plans/future/03)

## Blocked on
- Podcast publishing env, re-import and audit (task 15)
- Better Stack error-monitoring DSN (task 19) and uptime monitor on `/api/health` (task 20)
