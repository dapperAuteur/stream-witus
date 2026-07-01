import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "./client";
import { fetchAndParseFeed, type ParsedEpisode } from "@/lib/disctopia-rss";
import { podcastEpisodes, podcastShows } from "./schema/podcast";

// Owner-scoped podcast admin (multi-show ingest + publish, plans/03/04). Every
// function takes the owner's userId — episodes stay scoped by user_id. Only the
// owner reaches these (routes gate on isOwnerSession).

export function listShows() {
  return db.select().from(podcastShows).orderBy(podcastShows.name);
}

export async function getShowById(id: string) {
  const [s] = await db.select().from(podcastShows).where(eq(podcastShows.id, id)).limit(1);
  return s ?? null;
}

/** Update a show's iTunes channel config (feed metadata). */
export async function updateShowConfig(
  id: string,
  cfg: Partial<Pick<typeof podcastShows.$inferInsert, "description" | "author" | "ownerEmail" | "category" | "language" | "explicit" | "artworkUrl">>,
) {
  const [s] = await db
    .update(podcastShows)
    .set({ ...cfg, updatedAt: new Date() })
    .where(eq(podcastShows.id, id))
    .returning();
  return s ?? null;
}

export async function getShowBySlug(slug: string) {
  const [s] = await db.select().from(podcastShows).where(eq(podcastShows.slug, slug)).limit(1);
  return s ?? null;
}

/** All active episodes for the owner, with show slug/name joined. */
export function listAllEpisodes(userId: string) {
  return db
    .select({
      id: podcastEpisodes.id,
      title: podcastEpisodes.title,
      episodeNumber: podcastEpisodes.episodeNumber,
      status: podcastEpisodes.status,
      visibility: podcastEpisodes.visibility,
      artworkUrl: podcastEpisodes.artworkUrl,
      externalUrl: podcastEpisodes.externalUrl,
      disctopiaGuid: podcastEpisodes.disctopiaGuid,
      publishedAt: podcastEpisodes.publishedAt,
      showId: podcastEpisodes.showId,
      showSlug: podcastShows.slug,
      showName: podcastShows.name,
    })
    .from(podcastEpisodes)
    .leftJoin(podcastShows, eq(podcastEpisodes.showId, podcastShows.id))
    .where(and(eq(podcastEpisodes.userId, userId), eq(podcastEpisodes.isActive, true)))
    .orderBy(desc(podcastEpisodes.createdAt));
}

export async function getAdminEpisode(userId: string, id: string) {
  const [ep] = await db
    .select()
    .from(podcastEpisodes)
    .where(and(eq(podcastEpisodes.id, id), eq(podcastEpisodes.userId, userId)))
    .limit(1);
  return ep ?? null;
}

export interface EpisodeAdminInput {
  showId: string;
  title: string;
  episodeNumber?: number | null;
  showNotes?: string | null;
  showNotesExcerpt?: string | null;
  artworkUrl?: string | null;
  externalUrl?: string | null; // disctopia / listen url
  visibility?: "private" | "public";
}

export async function createAdminEpisode(userId: string, input: EpisodeAdminInput) {
  const [ep] = await db
    .insert(podcastEpisodes)
    .values({ ...input, userId })
    .returning();
  return ep;
}

export async function updateAdminEpisode(userId: string, id: string, input: Partial<EpisodeAdminInput>) {
  const [ep] = await db
    .update(podcastEpisodes)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(podcastEpisodes.id, id), eq(podcastEpisodes.userId, userId)))
    .returning();
  return ep ?? null;
}

/** Publish an episode: status→published + published_at. Returns episode + its show. */
export async function publishAdminEpisode(userId: string, id: string) {
  const [ep] = await db
    .update(podcastEpisodes)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(podcastEpisodes.id, id), eq(podcastEpisodes.userId, userId)))
    .returning();
  if (!ep) return null;
  const show = ep.showId ? await getShowById(ep.showId) : null;
  return { episode: ep, show };
}

/** Which of these Disctopia guids already exist (for the owner)? */
async function existingGuids(userId: string, guids: string[]): Promise<Set<string>> {
  if (guids.length === 0) return new Set();
  const rows = await db
    .select({ guid: podcastEpisodes.disctopiaGuid })
    .from(podcastEpisodes)
    .where(and(eq(podcastEpisodes.userId, userId), inArray(podcastEpisodes.disctopiaGuid, guids)));
  return new Set(rows.map((r) => r.guid).filter((g): g is string => g !== null));
}

/** Preview an import: which parsed episodes are new vs already-have / no-https-art. */
export async function buildImportPreview(userId: string, parsed: ParsedEpisode[]) {
  const have = await existingGuids(userId, parsed.map((e) => e.guid));
  const items = parsed.map((e) => ({
    guid: e.guid,
    title: e.title,
    episodeNumber: e.itunesEpisode,
    hasHttpsArtwork: e.artworkUrl.startsWith("https://"),
    willInsert: !have.has(e.guid) && e.artworkUrl.startsWith("https://"),
  }));
  const newCount = items.filter((i) => i.willInsert).length;
  return { items, newCount, skipCount: items.length - newCount };
}

/**
 * Re-import every show that has a Disctopia feed URL (the daily cron). New episodes
 * land as drafts; nothing auto-publishes, so no social drafts fire. Owner-attributed.
 * A feed error on one show doesn't stop the others.
 */
export async function importAllShows(ownerId: string) {
  const shows = await db
    .select({ id: podcastShows.id, slug: podcastShows.slug, feedUrl: podcastShows.feedUrl })
    .from(podcastShows)
    .where(isNotNull(podcastShows.feedUrl));

  const results: { slug: string; inserted?: number; skipped?: number; error?: string }[] = [];
  for (const show of shows) {
    try {
      const feed = await fetchAndParseFeed(show.feedUrl as string);
      const { inserted, skipped } = await importEpisodes(ownerId, show.id, feed.episodes);
      results.push({ slug: show.slug, inserted, skipped });
    } catch (err) {
      results.push({ slug: show.slug, error: err instanceof Error ? err.message : "import failed" });
    }
  }
  return results;
}

/** Insert new episodes from a parsed feed, deduped on disctopia_guid, as drafts. */
export async function importEpisodes(userId: string, showId: string, parsed: ParsedEpisode[]) {
  const guids = parsed.map((e) => e.guid);
  const skip = await existingGuids(userId, guids);
  // Outbox needs https media; skip rows without usable artwork.
  const toInsert = parsed.filter((e) => !skip.has(e.guid) && e.artworkUrl.startsWith("https://"));

  let inserted = 0;
  const failed: string[] = [];
  for (const e of toInsert) {
    try {
      await db.insert(podcastEpisodes).values({
        userId,
        showId,
        title: e.title,
        episodeNumber: e.itunesEpisode,
        showNotes: e.showNotes || e.title,
        showNotesExcerpt: e.showNotesExcerpt || e.title,
        artworkUrl: e.artworkUrl,
        audioUrl: e.audioUrl,
        audioLengthBytes: e.audioLength,
        audioMime: e.audioType,
        externalUrl: e.disctopiaUrl,
        disctopiaGuid: e.guid,
        publishedAt: e.pubDate,
        status: "draft", // never auto-fires; BAM re-publishes intentionally
      });
      inserted += 1;
    } catch {
      failed.push(e.guid);
    }
  }
  return { inserted, skipped: skip.size, failed };
}
