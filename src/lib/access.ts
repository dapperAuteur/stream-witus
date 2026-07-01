import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appSettings, waitlist } from "@/db/schema/admin";
import { users } from "@/db/schema/auth";
import { env } from "./env";

// Owner identity + signup gating. The OWNER (env.OWNER_EMAIL, default
// bam@awews.com) is the only address allowed to sign up while signups are closed,
// and the identity that gates the admin dashboard + the outbox owner-gate. Owner
// is resolved by EMAIL, so no user-id bootstrap is required.

const norm = (e: string) => e.trim().toLowerCase();

export function isOwnerEmail(email?: string | null): boolean {
  return Boolean(email && norm(email) === norm(env.OWNER_EMAIL));
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.email ?? null;
}

/** The outbox owner-gate: owner by email (primary) or the legacy env user id. */
export async function isOwnerUserId(userId: string): Promise<boolean> {
  if (env.PRODUCT_OWNER_USER_ID && userId === env.PRODUCT_OWNER_USER_ID) return true;
  return isOwnerEmail(await getUserEmail(userId));
}

// ── signups_open flag ────────────────────────────────────────────────────────
export async function signupsOpen(): Promise<boolean> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "signups_open")).limit(1);
  return row?.value === "true";
}

export async function setSignupsOpen(open: boolean): Promise<void> {
  const value = open ? "true" : "false";
  await db
    .insert(appSettings)
    .values({ key: "signups_open", value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}

// ── allow / waitlist ─────────────────────────────────────────────────────────
async function userExists(email: string): Promise<boolean> {
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.email, norm(email))).limit(1);
  return Boolean(u);
}

async function waitlistApproved(email: string): Promise<boolean> {
  const [w] = await db.select({ status: waitlist.status }).from(waitlist).where(eq(waitlist.email, norm(email))).limit(1);
  return w?.status === "approved";
}

/**
 * May this email complete a sign-in / sign-up? Owner always; existing members
 * always (so closing signups never locks anyone out); anyone if signups are open;
 * otherwise only if they've been approved off the waitlist.
 */
export async function isAllowedToSignIn(email: string): Promise<boolean> {
  const e = norm(email);
  if (isOwnerEmail(e)) return true;
  if (await userExists(e)) return true;
  if (await signupsOpen()) return true;
  return waitlistApproved(e);
}

export async function addToWaitlist(email: string): Promise<void> {
  await db.insert(waitlist).values({ email: norm(email) }).onConflictDoNothing();
}

// ── admin operations ─────────────────────────────────────────────────────────
export function listWaitlist() {
  return db.select().from(waitlist).orderBy(desc(waitlist.createdAt));
}

export async function setWaitlistStatus(email: string, status: "waiting" | "approved") {
  const [row] = await db
    .update(waitlist)
    .set({ status, updatedAt: new Date() })
    .where(eq(waitlist.email, norm(email)))
    .returning();
  return row ?? null;
}
