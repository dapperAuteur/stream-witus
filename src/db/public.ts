import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db as defaultDb } from "./client";
import { clubReads, clubs } from "./schema/club";
import { mediaItems } from "./schema/media";
import { mediaEpisodeLinks, podcastEpisodes } from "./schema/podcast";

type Db = typeof defaultDb;

/**
 * The PUBLIC read path — the additive "visibility=public" dimension the
 * owner-scoped invariant was designed to allow (CLAUDE.md). These reads are NOT
 * owner-scoped: they cross owners on purpose, but ONLY ever return rows with
 * `visibility = 'public'` (and active). This is the single chokepoint for
 * logged-out reads; nothing else may read another owner's data.
 *
 * Owner-scoped reads still go through ScopedDb. Keeping the two paths in separate
 * modules keeps the rule auditable: public.ts filters by visibility, scoped.ts by
 * user_id, and never the twain shall cross.
 */

export async function listPublicEpisodes(db: Db = defaultDb) {
  return db
    .select({
      id: podcastEpisodes.id,
      title: podcastEpisodes.title,
      episodeNumber: podcastEpisodes.episodeNumber,
      seasonNumber: podcastEpisodes.seasonNumber,
      airDate: podcastEpisodes.airDate,
      description: podcastEpisodes.description,
      durationMin: podcastEpisodes.durationMin,
    })
    .from(podcastEpisodes)
    .where(
      and(
        eq(podcastEpisodes.visibility, "public"),
        eq(podcastEpisodes.isActive, true),
        eq(podcastEpisodes.status, "published"),
      ),
    )
    .orderBy(desc(podcastEpisodes.airDate), desc(podcastEpisodes.createdAt));
}

/** A single public episode, or null. Private/inactive episodes 404 (return null). */
export async function getPublicEpisode(id: string, db: Db = defaultDb) {
  const [ep] = await db
    .select()
    .from(podcastEpisodes)
    .where(
      and(
        eq(podcastEpisodes.id, id),
        eq(podcastEpisodes.visibility, "public"),
        eq(podcastEpisodes.isActive, true),
      ),
    )
    .limit(1);
  return ep ?? null;
}

/**
 * The titles discussed in a public episode — basic display info only (title,
 * creator, type, cover, timestamp). Linking a title to a published episode is an
 * explicit publish act, so the reference is shown regardless of the item's own
 * visibility; private notes/spoilers are never exposed here.
 */
export async function listPublicEpisodeMedia(episodeId: string, db: Db = defaultDb) {
  return db
    .select({
      id: mediaEpisodeLinks.id,
      mediaItemId: mediaEpisodeLinks.mediaItemId,
      timestampStart: mediaEpisodeLinks.timestampStart,
      discussionNotes: mediaEpisodeLinks.discussionNotes,
      title: mediaItems.title,
      creator: mediaItems.creator,
      mediaType: mediaItems.mediaType,
      coverImageUrl: mediaItems.coverImageUrl,
    })
    .from(mediaEpisodeLinks)
    .innerJoin(mediaItems, eq(mediaEpisodeLinks.mediaItemId, mediaItems.id))
    .where(eq(mediaEpisodeLinks.episodeId, episodeId))
    .orderBy(asc(mediaEpisodeLinks.sortOrder));
}

/** A public ReadWitUS club by slug, or null. Private clubs 404. Discussion is NOT
 *  exposed publicly — only the club identity + its reading list. */
export async function getPublicClub(slug: string, db: Db = defaultDb) {
  const [club] = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      description: clubs.description,
    })
    .from(clubs)
    .where(and(eq(clubs.slug, slug), eq(clubs.visibility, "public")))
    .limit(1);
  return club ?? null;
}

export async function listPublicClubReads(clubId: string, db: Db = defaultDb) {
  return db
    .select({
      id: clubReads.id,
      title: clubReads.title,
      status: clubReads.status,
      startDate: clubReads.startDate,
      targetEndDate: clubReads.targetEndDate,
      mediaTitle: mediaItems.title,
      mediaCreator: mediaItems.creator,
      coverImageUrl: mediaItems.coverImageUrl,
    })
    .from(clubReads)
    .leftJoin(mediaItems, eq(clubReads.mediaItemId, mediaItems.id))
    .where(eq(clubReads.clubId, clubId))
    .orderBy(desc(clubReads.createdAt));
}
