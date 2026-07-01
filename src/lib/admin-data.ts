import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema/auth";
import type { ADMIN_ROLES } from "@/db/schema/auth";
import { adminAuditLog, type INBOX_STATUSES, inboxSubmissions, outboxLog, waitlist } from "@/db/schema/admin";
import { clubs } from "@/db/schema/club";
import { mediaItems } from "@/db/schema/media";
import { podcastEpisodes } from "@/db/schema/podcast";
import { getFlag } from "./access";
import { env, hasCloudinary, hasMailgun, hasTmdb } from "./env";

// ── Integration / config health ──────────────────────────────────────────────
export async function integrationHealth() {
  const [fail] = await db.select({ v: count() }).from(outboxLog).where(eq(outboxLog.ok, false));
  return {
    tmdb: hasTmdb,
    cloudinary: hasCloudinary,
    mailgun: hasMailgun,
    inbox: Boolean(env.INBOX_INGEST_URL && env.INBOX_SOURCE_SLUG && env.INBOX_INGEST_SECRET),
    outbox: Boolean(env.OUTBOX_INGEST_URL && env.OUTBOX_SOURCE_SLUG && env.OUTBOX_INGEST_SECRET),
    outboxFailures: fail?.v ?? 0,
  };
}

// ── Feature flags (curated, enforced) ────────────────────────────────────────
export const FEATURE_FLAGS = [
  { key: "club_creation_open", label: "Club creation open", fallback: true },
  { key: "public_profiles_enabled", label: "Public profiles (/shelf)", fallback: true },
] as const;

export async function featureFlags(): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const f of FEATURE_FLAGS) out[f.key] = await getFlag(f.key, f.fallback);
  return out;
}

async function ownerId(): Promise<string | null> {
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, env.OWNER_EMAIL.toLowerCase()))
    .limit(1);
  return u?.id ?? null;
}

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

// ── Members / users (owner-managed) ──────────────────────────────────────────
export function listUsers() {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      adminRole: users.adminRole,
      deactivated: users.deactivated,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
}

export async function getUserRow(id: string) {
  const [u] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

export async function setUserRole(id: string, role: (typeof ADMIN_ROLES)[number]) {
  const [u] = await db.update(users).set({ adminRole: role, updatedAt: new Date() }).where(eq(users.id, id)).returning({ id: users.id });
  return Boolean(u);
}

/** Deactivate/reactivate. Deactivating also kills the user's active sessions. */
export async function setUserDeactivated(id: string, deactivated: boolean) {
  const [u] = await db.update(users).set({ deactivated, updatedAt: new Date() }).where(eq(users.id, id)).returning({ id: users.id });
  if (u && deactivated) await db.delete(sessions).where(eq(sessions.userId, id));
  return Boolean(u);
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
export async function contentStats() {
  const oid = (await ownerId()) ?? "";
  const scoped = (extra?: ReturnType<typeof eq>) =>
    and(eq(mediaItems.userId, oid), eq(mediaItems.isActive, true), extra);
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
    db.select({ v: count() }).from(podcastEpisodes).where(and(eq(podcastEpisodes.userId, oid), eq(podcastEpisodes.isActive, true))),
    db.select({ v: count() }).from(podcastEpisodes).where(and(eq(podcastEpisodes.userId, oid), eq(podcastEpisodes.status, "published"))),
    db.select({ v: count() }).from(clubs).where(eq(clubs.ownerUserId, oid)),
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
