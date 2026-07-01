import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { adminAuditLog, type INBOX_STATUSES, inboxSubmissions, outboxLog, waitlist } from "@/db/schema/admin";
import { clubs } from "@/db/schema/club";
import { mediaItems } from "@/db/schema/media";
import { podcastEpisodes } from "@/db/schema/podcast";
import { getFlag } from "./access";
import { env } from "./env";

// ── Inbox triage (local mirror of inbound forms) ─────────────────────────────
export function listInboxSubmissions(limit = 100) {
  return db.select().from(inboxSubmissions).orderBy(desc(inboxSubmissions.createdAt)).limit(limit);
}

export async function setInboxStatus(id: string, status: (typeof INBOX_STATUSES)[number]) {
  const [row] = await db
    .update(inboxSubmissions)
    .set({ status })
    .where(eq(inboxSubmissions.id, id))
    .returning();
  return row ?? null;
}

// ── Outbox control panel ─────────────────────────────────────────────────────
export const OUTBOX_TRIGGERS = ["finished_media", "episode_published", "club_read"] as const;

export async function outboxFlags() {
  const master = await getFlag("outbox_enabled", env.OUTBOX_TRIGGER_ENABLED === "true");
  const triggers: Record<string, boolean> = {};
  for (const t of OUTBOX_TRIGGERS) triggers[t] = await getFlag(`outbox_trigger_${t}`, true);
  return { master, triggers };
}

export function listOutboxLog(limit = 50) {
  return db.select().from(outboxLog).orderBy(desc(outboxLog.createdAt)).limit(limit);
}

// ── Admin audit log ──────────────────────────────────────────────────────────
export async function logAdminAction(
  actor: { id: string; email: string },
  action: string,
  opts: { targetType?: string; targetId?: string; meta?: Record<string, unknown> } = {},
): Promise<void> {
  await db
    .insert(adminAuditLog)
    .values({
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      targetType: opts.targetType ?? null,
      targetId: opts.targetId ?? null,
      meta: opts.meta ?? null,
    })
    .catch(() => {}); // never let an audit write break the action it records
}

export function listAuditLog(limit = 100) {
  return db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit);
}

// ── Content stats (at-a-glance) ──────────────────────────────────────────────
export async function contentStats(ownerId: string) {
  const scoped = (extra?: ReturnType<typeof eq>) =>
    and(eq(mediaItems.userId, ownerId), eq(mediaItems.isActive, true), extra);
  const [
    mediaTotal,
    mediaInProgress,
    mediaCompleted,
    mediaPublic,
    epTotal,
    epPublished,
    clubTotal,
    waitlistWaiting,
    inboxNew,
  ] = await Promise.all([
    db.select({ v: count() }).from(mediaItems).where(scoped()),
    db.select({ v: count() }).from(mediaItems).where(scoped(eq(mediaItems.status, "in_progress"))),
    db.select({ v: count() }).from(mediaItems).where(scoped(eq(mediaItems.status, "completed"))),
    db.select({ v: count() }).from(mediaItems).where(scoped(eq(mediaItems.visibility, "public"))),
    db.select({ v: count() }).from(podcastEpisodes).where(and(eq(podcastEpisodes.userId, ownerId), eq(podcastEpisodes.isActive, true))),
    db.select({ v: count() }).from(podcastEpisodes).where(and(eq(podcastEpisodes.userId, ownerId), eq(podcastEpisodes.status, "published"))),
    db.select({ v: count() }).from(clubs).where(eq(clubs.ownerUserId, ownerId)),
    db.select({ v: count() }).from(waitlist).where(eq(waitlist.status, "waiting")),
    db.select({ v: count() }).from(inboxSubmissions).where(eq(inboxSubmissions.status, "new")),
  ]);
  const n = (r: { v: number }[]) => r[0]?.v ?? 0;
  return {
    mediaTotal: n(mediaTotal),
    mediaInProgress: n(mediaInProgress),
    mediaCompleted: n(mediaCompleted),
    mediaPublic: n(mediaPublic),
    episodes: n(epTotal),
    episodesPublished: n(epPublished),
    clubs: n(clubTotal),
    waitlistWaiting: n(waitlistWaiting),
    inboxNew: n(inboxNew),
  };
}
