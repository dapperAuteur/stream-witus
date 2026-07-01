import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/session";
import { db as defaultDb } from "./client";
import { users } from "./schema/auth";
import {
  type CLUB_ROLES,
  clubDiscussion,
  clubMemberProgress,
  clubMembers,
  clubReads,
  clubSchedule,
  clubs,
} from "./schema/club";

type Db = typeof defaultDb;
type Role = (typeof CLUB_ROLES)[number];

/**
 * Membership-scoped club access. Where ScopedDb scopes by user_id (owner-only),
 * clubs are scoped by MEMBERSHIP: a user reaches club content only if they belong
 * to the club. The spoiler-safe mechanic lives here too — discussion posts tied to
 * a milestone are LOCKED (body withheld, not just visually blurred) for any member
 * whose progress is below that milestone, so a spoiler can never reach the wire.
 */
export class ClubScoped {
  readonly userId: string;
  private readonly db: Db;

  constructor(userId: string, database: Db = defaultDb) {
    this.userId = userId;
    this.db = database;
  }

  // ── Membership ─────────────────────────────────────────────────────────────
  /** This user's role in the club, or null if they're not a member. */
  async myRole(clubId: string): Promise<Role | null> {
    const [m] = await this.db
      .select({ role: clubMembers.role })
      .from(clubMembers)
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, this.userId)))
      .limit(1);
    return m?.role ?? null;
  }

  private async canManage(clubId: string): Promise<boolean> {
    const role = await this.myRole(clubId);
    return role === "owner" || role === "moderator";
  }

  // ── Clubs ──────────────────────────────────────────────────────────────────
  async listClubs() {
    return this.db
      .select({
        id: clubs.id,
        name: clubs.name,
        slug: clubs.slug,
        description: clubs.description,
        visibility: clubs.visibility,
        role: clubMembers.role,
      })
      .from(clubMembers)
      .innerJoin(clubs, eq(clubMembers.clubId, clubs.id))
      .where(eq(clubMembers.userId, this.userId))
      .orderBy(asc(clubs.name));
  }

  async createClub(input: { name: string; slug: string; description?: string | null; visibility?: "private" | "public" }) {
    const [club] = await this.db
      .insert(clubs)
      .values({ ...input, ownerUserId: this.userId })
      .returning();
    // The creator is the owner member.
    await this.db
      .insert(clubMembers)
      .values({ clubId: club.id, userId: this.userId, role: "owner" })
      .onConflictDoNothing();
    return club;
  }

  /** A club this user belongs to, or null (caller 404s — no membership, no peek). */
  async getClub(clubId: string) {
    if (!(await this.myRole(clubId))) return null;
    const [club] = await this.db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    return club ?? null;
  }

  async updateClub(clubId: string, updates: Partial<typeof clubs.$inferInsert>) {
    if (!(await this.canManage(clubId))) return null;
    const [club] = await this.db
      .update(clubs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clubs.id, clubId))
      .returning();
    return club ?? null;
  }

  async listMembers(clubId: string) {
    if (!(await this.myRole(clubId))) return null;
    return this.db
      .select({
        userId: clubMembers.userId,
        role: clubMembers.role,
        joinedAt: clubMembers.joinedAt,
        email: users.email,
        name: users.name,
      })
      .from(clubMembers)
      .innerJoin(users, eq(clubMembers.userId, users.id))
      .where(eq(clubMembers.clubId, clubId))
      .orderBy(asc(clubMembers.joinedAt));
  }

  /** Add a member by email (owner/mod only). Returns null if not allowed / no such user. */
  async addMemberByEmail(clubId: string, email: string, role: Role = "member") {
    if (!(await this.canManage(clubId))) return null;
    const [u] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);
    if (!u) return { error: "no_user" as const };
    const [m] = await this.db
      .insert(clubMembers)
      .values({ clubId, userId: u.id, role })
      .onConflictDoNothing()
      .returning();
    return { member: m ?? null };
  }

  // ── Reads ──────────────────────────────────────────────────────────────────
  async listReads(clubId: string) {
    if (!(await this.myRole(clubId))) return null;
    return this.db
      .select()
      .from(clubReads)
      .where(eq(clubReads.clubId, clubId))
      .orderBy(desc(clubReads.createdAt));
  }

  async createRead(
    clubId: string,
    input: { mediaItemId?: string | null; title?: string | null; status?: "upcoming" | "active" | "completed"; startDate?: string | null; targetEndDate?: string | null },
  ) {
    if (!(await this.canManage(clubId))) return null;
    const [read] = await this.db
      .insert(clubReads)
      .values({ ...input, clubId })
      .returning();
    return read;
  }

  /** A read scoped to a club this user belongs to (else null). */
  async getRead(clubId: string, readId: string) {
    if (!(await this.myRole(clubId))) return null;
    const [read] = await this.db
      .select()
      .from(clubReads)
      .where(and(eq(clubReads.id, readId), eq(clubReads.clubId, clubId)))
      .limit(1);
    return read ?? null;
  }

  // ── Schedule (milestones) ────────────────────────────────────────────────
  async listSchedule(clubId: string, readId: string) {
    if (!(await this.getRead(clubId, readId))) return null;
    return this.db
      .select()
      .from(clubSchedule)
      .where(eq(clubSchedule.clubReadId, readId))
      .orderBy(asc(clubSchedule.sortOrder));
  }

  async createMilestone(clubId: string, readId: string, input: { label: string; dueDate?: string | null; sortOrder?: number }) {
    if (!(await this.canManage(clubId))) return null;
    if (!(await this.getRead(clubId, readId))) return null;
    const [m] = await this.db
      .insert(clubSchedule)
      .values({ ...input, clubReadId: readId })
      .returning();
    return m;
  }

  // ── Member progress ─────────────────────────────────────────────────────
  async getMyProgress(clubId: string, readId: string) {
    if (!(await this.getRead(clubId, readId))) return null;
    const [p] = await this.db
      .select()
      .from(clubMemberProgress)
      .where(and(eq(clubMemberProgress.clubReadId, readId), eq(clubMemberProgress.userId, this.userId)))
      .limit(1);
    return p ?? null;
  }

  /** Set my current milestone for a read (upsert on (read, user)). */
  async setMyProgress(clubId: string, readId: string, milestoneId: string | null) {
    if (!(await this.getRead(clubId, readId))) return null;
    // Validate the milestone belongs to this read (or is null = reset).
    if (milestoneId) {
      const [ms] = await this.db
        .select({ id: clubSchedule.id })
        .from(clubSchedule)
        .where(and(eq(clubSchedule.id, milestoneId), eq(clubSchedule.clubReadId, readId)))
        .limit(1);
      if (!ms) return null;
    }
    const [p] = await this.db
      .insert(clubMemberProgress)
      .values({ clubReadId: readId, userId: this.userId, currentMilestoneId: milestoneId })
      .onConflictDoUpdate({
        target: [clubMemberProgress.clubReadId, clubMemberProgress.userId],
        set: { currentMilestoneId: milestoneId, updatedAt: new Date() },
      })
      .returning();
    return p;
  }

  /** The sortOrder this user has reached for a read, or -1 if no progress set. */
  private async myMilestoneOrder(readId: string): Promise<number> {
    const [row] = await this.db
      .select({ sortOrder: clubSchedule.sortOrder })
      .from(clubMemberProgress)
      .innerJoin(clubSchedule, eq(clubMemberProgress.currentMilestoneId, clubSchedule.id))
      .where(and(eq(clubMemberProgress.clubReadId, readId), eq(clubMemberProgress.userId, this.userId)))
      .limit(1);
    return row?.sortOrder ?? -1;
  }

  // ── Discussion (progress-gated, spoiler-safe) ─────────────────────────────
  async listDiscussion(clubId: string, readId: string) {
    const role = await this.myRole(clubId);
    if (!role || !(await this.getRead(clubId, readId))) return null;
    const myOrder = await this.myMilestoneOrder(readId);
    const canSeeAll = role === "owner" || role === "moderator";

    const rows = await this.db
      .select({
        id: clubDiscussion.id,
        userId: clubDiscussion.userId,
        parentId: clubDiscussion.parentId,
        milestoneId: clubDiscussion.milestoneId,
        isSpoiler: clubDiscussion.isSpoiler,
        body: clubDiscussion.body,
        createdAt: clubDiscussion.createdAt,
        authorName: users.name,
        authorEmail: users.email,
        milestoneLabel: clubSchedule.label,
        milestoneOrder: clubSchedule.sortOrder,
      })
      .from(clubDiscussion)
      .innerJoin(users, eq(clubDiscussion.userId, users.id))
      .leftJoin(clubSchedule, eq(clubDiscussion.milestoneId, clubSchedule.id))
      // Moderator-removed posts are hidden from members.
      .where(and(eq(clubDiscussion.clubReadId, readId), eq(clubDiscussion.removed, false)))
      .orderBy(asc(clubDiscussion.createdAt));

    return rows.map((r) => {
      // A post is locked when it's tied to a milestone the viewer hasn't reached —
      // unless they wrote it or they manage the club. Locked → body withheld.
      const gated = r.milestoneOrder != null && r.milestoneOrder > myOrder;
      const locked = gated && r.userId !== this.userId && !canSeeAll;
      return {
        id: r.id,
        parentId: r.parentId,
        milestoneId: r.milestoneId,
        milestoneLabel: r.milestoneLabel,
        isSpoiler: r.isSpoiler,
        authorName: r.authorName ?? r.authorEmail,
        createdAt: r.createdAt,
        locked,
        body: locked ? null : r.body,
        isMine: r.userId === this.userId,
      };
    });
  }

  async createPost(
    clubId: string,
    readId: string,
    input: { milestoneId?: string | null; isSpoiler?: boolean; body: string; parentId?: string | null },
  ) {
    if (!(await this.myRole(clubId)) || !(await this.getRead(clubId, readId))) return null;
    if (!input.body?.trim()) return null;
    // If a milestone is given, it must belong to this read.
    if (input.milestoneId) {
      const [ms] = await this.db
        .select({ id: clubSchedule.id })
        .from(clubSchedule)
        .where(and(eq(clubSchedule.id, input.milestoneId), eq(clubSchedule.clubReadId, readId)))
        .limit(1);
      if (!ms) return null;
    }
    const [post] = await this.db
      .insert(clubDiscussion)
      .values({
        clubReadId: readId,
        userId: this.userId,
        milestoneId: input.milestoneId ?? null,
        isSpoiler: input.isSpoiler ?? false,
        body: input.body.trim(),
        parentId: input.parentId ?? null,
      })
      .returning();
    return post;
  }
}

export async function getClubScoped(): Promise<ClubScoped | null> {
  const userId = await getSessionUserId();
  return userId ? new ClubScoped(userId) : null;
}
