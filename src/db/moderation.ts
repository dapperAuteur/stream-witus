import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema/auth";
import { clubDiscussion, clubReads, clubs } from "./schema/club";

// Cross-club moderation (moderator+). Not membership-scoped — moderators act across
// the whole app, unlike ClubScoped (which is per-member). Owner-gated at the route.

// ── Feature a public club (surfaced on /clubs) ───────────────────────────────
export function listPublicClubsForMod() {
  return db
    .select({ id: clubs.id, slug: clubs.slug, name: clubs.name, featured: clubs.featured })
    .from(clubs)
    .where(eq(clubs.visibility, "public"))
    .orderBy(desc(clubs.featured), clubs.name);
}

export async function setClubFeatured(clubId: string, featured: boolean) {
  const [row] = await db
    .update(clubs)
    .set({ featured, updatedAt: new Date() })
    .where(eq(clubs.id, clubId))
    .returning({ id: clubs.id });
  return Boolean(row);
}

// ── Recent discussion posts (takedown queue) ─────────────────────────────────
export function listRecentPosts(limit = 50) {
  return db
    .select({
      id: clubDiscussion.id,
      body: clubDiscussion.body,
      removed: clubDiscussion.removed,
      isSpoiler: clubDiscussion.isSpoiler,
      createdAt: clubDiscussion.createdAt,
      authorName: users.name,
      authorEmail: users.email,
      clubName: clubs.name,
      readTitle: clubReads.title,
    })
    .from(clubDiscussion)
    .innerJoin(users, eq(clubDiscussion.userId, users.id))
    .innerJoin(clubReads, eq(clubDiscussion.clubReadId, clubReads.id))
    .innerJoin(clubs, eq(clubReads.clubId, clubs.id))
    .orderBy(desc(clubDiscussion.createdAt))
    .limit(limit);
}

export async function setPostRemoved(postId: string, removed: boolean) {
  const [row] = await db
    .update(clubDiscussion)
    .set({ removed, updatedAt: new Date() })
    .where(eq(clubDiscussion.id, postId))
    .returning({ id: clubDiscussion.id });
  return Boolean(row);
}
