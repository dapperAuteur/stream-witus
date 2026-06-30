import "server-only";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getSessionUserId } from "@/lib/session";
import { db as defaultDb } from "./client";
import {
  type MEDIA_STATUSES,
  type MEDIA_TYPES,
  type VISIBILITIES,
  mediaCategories,
  mediaCreators,
  mediaItems,
  mediaPlatforms,
} from "./schema/media";
import { mediaNotes, mediaRelationships } from "./schema/notes";
import { mediaEpisodeLinks, podcastEpisodes } from "./schema/podcast";

type Db = typeof defaultDb;

/** Default per-user categories, seeded on first read (CentOS parity). */
const DEFAULT_CATEGORIES = [
  { name: "Books", icon: "book", color: "#8b5cf6", sortOrder: 0 },
  { name: "TV & Film", icon: "film", color: "#ec4899", sortOrder: 1 },
  { name: "Music", icon: "music", color: "#06b6d4", sortOrder: 2 },
  { name: "Podcasts", icon: "mic", color: "#f59e0b", sortOrder: 3 },
  { name: "Art", icon: "palette", color: "#10b981", sortOrder: 4 },
  { name: "Other", icon: "circle", color: "#6b7280", sortOrder: 5 },
] as const;

export interface MediaListFilters {
  mediaType?: string | null;
  status?: string | null;
  categoryId?: string | null;
  search?: string | null;
  isFavorite?: boolean;
  limit?: number;
  offset?: number;
}

export interface MediaItemInput {
  title: string;
  mediaType: (typeof MEDIA_TYPES)[number];
  creator?: string | null;
  categoryId?: string | null;
  status?: (typeof MEDIA_STATUSES)[number];
  rating?: number | null;
  genre?: string[] | null;
  tags?: string[] | null;
  coverImageUrl?: string | null;
  externalUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  yearReleased?: number | null;
  sourcePlatform?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  totalSeasons?: number | null;
  totalEpisodes?: number | null;
  currentProgress?: string | null;
  totalLength?: string | null;
  visibility?: (typeof VISIBILITIES)[number];
  isFavorite?: boolean;
  notes?: string | null;
  externalSource?: "tmdb" | "openlibrary" | "manual" | null;
  externalId?: string | null;
}

/**
 * The mandatory owner-scoped data-access chokepoint.
 *
 * Every content query goes through a ScopedDb so `user_id` is baked in and no
 * route handler can run an unscoped read (CLAUDE.md "owner-scoped → public-ready"
 * invariant). Rules:
 *   - list  → WHERE user_id = current
 *   - by-id → fetch already filtered by user_id; a foreign id returns null and the
 *             caller 404s (never redirect — a redirect leaks existence).
 *
 * Designed so a later `visibility=public` / multi-user read path is an *additive*
 * method (e.g. publicShowNote(slug)) — not a refactor of these owner-scoped reads.
 */
export class ScopedDb {
  readonly userId: string;
  private readonly db: Db;

  constructor(userId: string, database: Db = defaultDb) {
    this.userId = userId;
    this.db = database;
  }

  // ── Media items ────────────────────────────────────────────────────────────
  private mediaWhere(filters: MediaListFilters) {
    const conds = [eq(mediaItems.userId, this.userId), eq(mediaItems.isActive, true)];
    if (filters.mediaType) conds.push(eq(mediaItems.mediaType, filters.mediaType as never));
    if (filters.status) conds.push(eq(mediaItems.status, filters.status as never));
    if (filters.categoryId) conds.push(eq(mediaItems.categoryId, filters.categoryId));
    if (filters.isFavorite) conds.push(eq(mediaItems.isFavorite, true));
    if (filters.search) {
      const term = `%${filters.search}%`;
      conds.push(
        or(
          ilike(mediaItems.title, term),
          ilike(mediaItems.creator, term),
          ilike(mediaItems.sourcePlatform, term),
        )!,
      );
    }
    return and(...conds);
  }

  async listMediaItems(filters: MediaListFilters = {}) {
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;
    const where = this.mediaWhere(filters);
    const [items, totalRow] = await Promise.all([
      this.db
        .select()
        .from(mediaItems)
        .where(where)
        .orderBy(desc(mediaItems.updatedAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(mediaItems).where(where),
    ]);
    return { items, total: totalRow[0]?.value ?? 0 };
  }

  /** Existing active item with this external provenance, or null (Phase 4 dedup). */
  async findByExternal(source: string, externalId: string) {
    const [item] = await this.db
      .select()
      .from(mediaItems)
      .where(
        and(
          eq(mediaItems.userId, this.userId),
          eq(mediaItems.externalSource, source as never),
          eq(mediaItems.externalId, externalId),
          eq(mediaItems.isActive, true),
        ),
      )
      .limit(1);
    return item ?? null;
  }

  async createMediaItem(input: MediaItemInput) {
    // Idempotent re-import: a second add of the same external title returns the
    // existing row instead of duplicating it (Phase 4 acceptance criterion).
    if (input.externalSource && input.externalId) {
      const existing = await this.findByExternal(input.externalSource, input.externalId);
      if (existing) return existing;
    }
    const [item] = await this.db
      .insert(mediaItems)
      .values({ ...input, userId: this.userId })
      .returning();
    return item;
  }

  /** By-id, scoped: a foreign id returns null → caller 404s (never cross-owner). */
  async getMediaItem(id: string) {
    const [item] = await this.db
      .select()
      .from(mediaItems)
      .where(and(eq(mediaItems.id, id), eq(mediaItems.userId, this.userId)))
      .limit(1);
    return item ?? null;
  }

  async updateMediaItem(id: string, updates: Partial<MediaItemInput>) {
    const [item] = await this.db
      .update(mediaItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(mediaItems.id, id), eq(mediaItems.userId, this.userId)))
      .returning();
    return item ?? null;
  }

  /** Soft delete (is_active=false), CentOS parity. Returns false if not owned. */
  async softDeleteMediaItem(id: string): Promise<boolean> {
    const [item] = await this.db
      .update(mediaItems)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(mediaItems.id, id), eq(mediaItems.userId, this.userId)))
      .returning({ id: mediaItems.id });
    return Boolean(item);
  }

  /** Shape matches the CentOS hub: { totalItems, inProgress, completed, favorites, avgRating }. */
  async summary() {
    const rows = await this.db
      .select({
        status: mediaItems.status,
        rating: mediaItems.rating,
        isFavorite: mediaItems.isFavorite,
      })
      .from(mediaItems)
      .where(and(eq(mediaItems.userId, this.userId), eq(mediaItems.isActive, true)));

    let inProgress = 0;
    let completed = 0;
    let favorites = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    for (const r of rows) {
      if (r.status === "in_progress") inProgress += 1;
      if (r.status === "completed") completed += 1;
      if (r.isFavorite) favorites += 1;
      if (typeof r.rating === "number") {
        ratingSum += r.rating;
        ratingCount += 1;
      }
    }
    return {
      totalItems: rows.length,
      inProgress,
      completed,
      favorites,
      avgRating: ratingCount ? Math.round((ratingSum / ratingCount) * 100) / 100 : null,
    };
  }

  // ── Notes ────────────────────────────────────────────────────────────────
  private async ownsItem(id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: mediaItems.id })
      .from(mediaItems)
      .where(and(eq(mediaItems.id, id), eq(mediaItems.userId, this.userId)))
      .limit(1);
    return Boolean(row);
  }

  async listNotes(mediaItemId: string) {
    return this.db
      .select()
      .from(mediaNotes)
      .where(and(eq(mediaNotes.userId, this.userId), eq(mediaNotes.mediaItemId, mediaItemId)))
      .orderBy(asc(mediaNotes.sortOrder), desc(mediaNotes.createdAt));
  }

  async createNote(
    mediaItemId: string,
    input: {
      title?: string | null;
      content?: string;
      contentFormat?: "markdown" | "tiptap";
      noteType?: (typeof mediaNotes.noteType.enumValues)[number];
      audioUrl?: string | null;
      audioPublicId?: string | null;
      isPublic?: boolean;
      sortOrder?: number;
    },
  ) {
    if (!(await this.ownsItem(mediaItemId))) return null;
    const [note] = await this.db
      .insert(mediaNotes)
      .values({ ...input, mediaItemId, userId: this.userId })
      .returning();
    return note;
  }

  async updateNote(
    mediaItemId: string,
    noteId: string,
    updates: Partial<typeof mediaNotes.$inferInsert>,
  ) {
    const [note] = await this.db
      .update(mediaNotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(mediaNotes.id, noteId),
          eq(mediaNotes.userId, this.userId),
          eq(mediaNotes.mediaItemId, mediaItemId),
        ),
      )
      .returning();
    return note ?? null;
  }

  async deleteNote(mediaItemId: string, noteId: string): Promise<boolean> {
    const [row] = await this.db
      .delete(mediaNotes)
      .where(
        and(
          eq(mediaNotes.id, noteId),
          eq(mediaNotes.userId, this.userId),
          eq(mediaNotes.mediaItemId, mediaItemId),
        ),
      )
      .returning({ id: mediaNotes.id });
    return Boolean(row);
  }

  // ── Relationships (adaptations etc.) ───────────────────────────────────────
  /**
   * Enriched, CentOS-shaped: each row is { relationship_id, relationship_type,
   * direction, sort_order, item }. `direction` is from the anchor item's view —
   * "child" means the anchor is the parent and the linked item is its child.
   */
  async listRelationships(mediaItemId: string) {
    const cols = {
      relationship_id: mediaRelationships.id,
      relationship_type: mediaRelationships.relationshipType,
      sort_order: mediaRelationships.sortOrder,
      itemId: mediaItems.id,
      itemTitle: mediaItems.title,
      itemMediaType: mediaItems.mediaType,
      itemCover: mediaItems.coverImageUrl,
    };
    // Anchor is the parent → the joined (child) item; direction "child".
    const children = await this.db
      .select(cols)
      .from(mediaRelationships)
      .innerJoin(mediaItems, eq(mediaRelationships.childId, mediaItems.id))
      .where(
        and(eq(mediaRelationships.userId, this.userId), eq(mediaRelationships.parentId, mediaItemId)),
      )
      .orderBy(asc(mediaRelationships.sortOrder));
    // Anchor is the child → the joined (parent) item; direction "parent".
    const parents = await this.db
      .select(cols)
      .from(mediaRelationships)
      .innerJoin(mediaItems, eq(mediaRelationships.parentId, mediaItems.id))
      .where(
        and(eq(mediaRelationships.userId, this.userId), eq(mediaRelationships.childId, mediaItemId)),
      )
      .orderBy(asc(mediaRelationships.sortOrder));

    const shape = (r: (typeof children)[number], direction: "parent" | "child") => ({
      relationship_id: r.relationship_id,
      relationship_type: r.relationship_type,
      direction,
      sort_order: r.sort_order ?? 0,
      item: {
        id: r.itemId,
        title: r.itemTitle,
        media_type: r.itemMediaType,
        cover_image_url: r.itemCover,
      },
    });
    return [...children.map((r) => shape(r, "child")), ...parents.map((r) => shape(r, "parent"))];
  }

  /**
   * Create from the anchor item's view. direction "child": anchor is the parent,
   * relatedId is the child. direction "parent": relatedId is the parent.
   */
  async createRelationship(input: {
    anchorId: string;
    relatedId: string;
    relationshipType: (typeof mediaRelationships.relationshipType.enumValues)[number];
    direction: "parent" | "child";
    sortOrder?: number;
  }) {
    const parentId = input.direction === "child" ? input.anchorId : input.relatedId;
    const childId = input.direction === "child" ? input.relatedId : input.anchorId;
    if (parentId === childId) return null;
    // Both endpoints must belong to the owner — prevents linking to a foreign item.
    const [ownsParent, ownsChild] = await Promise.all([
      this.ownsItem(parentId),
      this.ownsItem(childId),
    ]);
    if (!ownsParent || !ownsChild) return null;
    const [rel] = await this.db
      .insert(mediaRelationships)
      .values({
        parentId,
        childId,
        relationshipType: input.relationshipType,
        sortOrder: input.sortOrder ?? 0,
        userId: this.userId,
      })
      .returning();
    return rel;
  }

  async deleteRelationship(relationshipId: string): Promise<boolean> {
    const [row] = await this.db
      .delete(mediaRelationships)
      .where(
        and(eq(mediaRelationships.id, relationshipId), eq(mediaRelationships.userId, this.userId)),
      )
      .returning({ id: mediaRelationships.id });
    return Boolean(row);
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  async listCategories() {
    const rows = await this.db
      .select()
      .from(mediaCategories)
      .where(eq(mediaCategories.userId, this.userId))
      .orderBy(asc(mediaCategories.sortOrder));
    if (rows.length > 0) return rows;
    // Auto-seed defaults on first read (CentOS parity).
    await this.db
      .insert(mediaCategories)
      .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: this.userId })))
      .onConflictDoNothing();
    return this.db
      .select()
      .from(mediaCategories)
      .where(eq(mediaCategories.userId, this.userId))
      .orderBy(asc(mediaCategories.sortOrder));
  }

  async createCategory(input: { name: string; icon?: string | null; color?: string; sortOrder?: number }) {
    const [row] = await this.db
      .insert(mediaCategories)
      .values({ ...input, userId: this.userId })
      .returning();
    return row;
  }

  async updateCategory(id: string, updates: { name?: string; icon?: string | null; color?: string; sortOrder?: number }) {
    const [row] = await this.db
      .update(mediaCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(mediaCategories.id, id), eq(mediaCategories.userId, this.userId)))
      .returning();
    return row ?? null;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const [row] = await this.db
      .delete(mediaCategories)
      .where(and(eq(mediaCategories.id, id), eq(mediaCategories.userId, this.userId)))
      .returning({ id: mediaCategories.id });
    return Boolean(row);
  }

  // ── Creators & platforms (autocomplete caches) ──────────────────────────────
  listCreators() {
    return this.db
      .select()
      .from(mediaCreators)
      .where(eq(mediaCreators.userId, this.userId))
      .orderBy(desc(mediaCreators.useCount), asc(mediaCreators.name));
  }

  /** Insert-or-bump: reusing a name increments use_count (CentOS parity). */
  async upsertCreator(name: string) {
    const [row] = await this.db
      .insert(mediaCreators)
      .values({ name, userId: this.userId, useCount: 1 })
      .onConflictDoUpdate({
        target: [mediaCreators.userId, mediaCreators.name],
        set: { useCount: sql`${mediaCreators.useCount} + 1` },
      })
      .returning();
    return row;
  }

  async updateCreator(id: string, name: string) {
    const [row] = await this.db
      .update(mediaCreators)
      .set({ name })
      .where(and(eq(mediaCreators.id, id), eq(mediaCreators.userId, this.userId)))
      .returning();
    return row ?? null;
  }

  async deleteCreator(id: string): Promise<boolean> {
    const [row] = await this.db
      .delete(mediaCreators)
      .where(and(eq(mediaCreators.id, id), eq(mediaCreators.userId, this.userId)))
      .returning({ id: mediaCreators.id });
    return Boolean(row);
  }

  listPlatforms() {
    return this.db
      .select()
      .from(mediaPlatforms)
      .where(eq(mediaPlatforms.userId, this.userId))
      .orderBy(desc(mediaPlatforms.useCount), asc(mediaPlatforms.name));
  }

  async upsertPlatform(name: string) {
    const [row] = await this.db
      .insert(mediaPlatforms)
      .values({ name, userId: this.userId, useCount: 1 })
      .onConflictDoUpdate({
        target: [mediaPlatforms.userId, mediaPlatforms.name],
        set: { useCount: sql`${mediaPlatforms.useCount} + 1` },
      })
      .returning();
    return row;
  }

  async updatePlatform(id: string, name: string) {
    const [row] = await this.db
      .update(mediaPlatforms)
      .set({ name })
      .where(and(eq(mediaPlatforms.id, id), eq(mediaPlatforms.userId, this.userId)))
      .returning();
    return row ?? null;
  }

  async deletePlatform(id: string): Promise<boolean> {
    const [row] = await this.db
      .delete(mediaPlatforms)
      .where(and(eq(mediaPlatforms.id, id), eq(mediaPlatforms.userId, this.userId)))
      .returning({ id: mediaPlatforms.id });
    return Boolean(row);
  }

  // ── CSV import / export ──────────────────────────────────────────────────
  async importMediaItems(rows: MediaItemInput[]) {
    if (rows.length === 0) return { inserted: 0 };
    const values = rows.map((r) => ({ ...r, userId: this.userId }));
    const inserted = await this.db.insert(mediaItems).values(values).returning({ id: mediaItems.id });
    return { inserted: inserted.length };
  }

  exportMediaItems() {
    return this.db
      .select()
      .from(mediaItems)
      .where(and(eq(mediaItems.userId, this.userId), eq(mediaItems.isActive, true)))
      .orderBy(desc(mediaItems.updatedAt));
  }

  // ── Podcast episodes ─────────────────────────────────────────────────────
  listEpisodes() {
    return this.db
      .select()
      .from(podcastEpisodes)
      .where(and(eq(podcastEpisodes.userId, this.userId), eq(podcastEpisodes.isActive, true)))
      .orderBy(desc(podcastEpisodes.createdAt));
  }

  async createEpisode(input: Partial<typeof podcastEpisodes.$inferInsert> & { title: string }) {
    const [ep] = await this.db
      .insert(podcastEpisodes)
      .values({ ...input, userId: this.userId })
      .returning();
    return ep;
  }

  async getEpisode(id: string) {
    const [ep] = await this.db
      .select()
      .from(podcastEpisodes)
      .where(and(eq(podcastEpisodes.id, id), eq(podcastEpisodes.userId, this.userId)))
      .limit(1);
    return ep ?? null;
  }

  async updateEpisode(id: string, updates: Partial<typeof podcastEpisodes.$inferInsert>) {
    const [ep] = await this.db
      .update(podcastEpisodes)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(podcastEpisodes.id, id), eq(podcastEpisodes.userId, this.userId)))
      .returning();
    return ep ?? null;
  }

  async softDeleteEpisode(id: string): Promise<boolean> {
    const [ep] = await this.db
      .update(podcastEpisodes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(podcastEpisodes.id, id), eq(podcastEpisodes.userId, this.userId)))
      .returning({ id: podcastEpisodes.id });
    return Boolean(ep);
  }

  // ── Podcast episode ↔ media links ───────────────────────────────────────────
  private async ownsEpisode(episodeId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: podcastEpisodes.id })
      .from(podcastEpisodes)
      .where(and(eq(podcastEpisodes.id, episodeId), eq(podcastEpisodes.userId, this.userId)))
      .limit(1);
    return Boolean(row);
  }

  /** Flattened to the CentOS shape the episode-detail page consumes. */
  async listEpisodeLinks(episodeId: string) {
    if (!(await this.ownsEpisode(episodeId))) return null;
    return this.db
      .select({
        id: mediaEpisodeLinks.id,
        media_item_id: mediaEpisodeLinks.mediaItemId,
        discussion_notes: mediaEpisodeLinks.discussionNotes,
        timestamp_start: mediaEpisodeLinks.timestampStart,
        title: mediaItems.title,
        media_type: mediaItems.mediaType,
        creator: mediaItems.creator,
        cover_image_url: mediaItems.coverImageUrl,
      })
      .from(mediaEpisodeLinks)
      .innerJoin(mediaItems, eq(mediaEpisodeLinks.mediaItemId, mediaItems.id))
      .where(
        and(eq(mediaEpisodeLinks.userId, this.userId), eq(mediaEpisodeLinks.episodeId, episodeId)),
      )
      .orderBy(asc(mediaEpisodeLinks.sortOrder));
  }

  async linkMediaToEpisode(
    episodeId: string,
    input: { mediaItemId: string; discussionNotes?: string | null; timestampStart?: string | null; sortOrder?: number },
  ) {
    const [ownsEp, ownsItem] = await Promise.all([
      this.ownsEpisode(episodeId),
      this.ownsItem(input.mediaItemId),
    ]);
    if (!ownsEp || !ownsItem) return null;
    const [row] = await this.db
      .insert(mediaEpisodeLinks)
      .values({ ...input, episodeId, userId: this.userId })
      .returning();
    return row;
  }

  /** Edit a link's timestamp / discussion notes after it's created (owner-scoped). */
  async updateEpisodeLink(
    episodeId: string,
    mediaItemId: string,
    updates: { timestampStart?: string | null; discussionNotes?: string | null },
  ) {
    const [row] = await this.db
      .update(mediaEpisodeLinks)
      .set(updates)
      .where(
        and(
          eq(mediaEpisodeLinks.userId, this.userId),
          eq(mediaEpisodeLinks.episodeId, episodeId),
          eq(mediaEpisodeLinks.mediaItemId, mediaItemId),
        ),
      )
      .returning();
    return row ?? null;
  }

  async unlinkMediaFromEpisode(episodeId: string, mediaItemId: string): Promise<boolean> {
    const [row] = await this.db
      .delete(mediaEpisodeLinks)
      .where(
        and(
          eq(mediaEpisodeLinks.userId, this.userId),
          eq(mediaEpisodeLinks.episodeId, episodeId),
          eq(mediaEpisodeLinks.mediaItemId, mediaItemId),
        ),
      )
      .returning({ id: mediaEpisodeLinks.id });
    return Boolean(row);
  }
}

/** Build a ScopedDb for the current request, or null if unauthenticated (caller → 401). */
export async function getScopedDb(): Promise<ScopedDb | null> {
  const userId = await getSessionUserId();
  return userId ? new ScopedDb(userId) : null;
}
