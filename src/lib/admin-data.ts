import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { type INBOX_STATUSES, inboxSubmissions, outboxLog } from "@/db/schema/admin";
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
