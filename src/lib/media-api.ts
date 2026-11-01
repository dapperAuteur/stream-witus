import type {
  mediaCategories,
  mediaCreators,
  mediaItems,
  mediaPlatforms,
} from "@/db/schema/media";
import type { mediaNotes } from "@/db/schema/notes";
import type { mediaEpisodeLinks, podcastEpisodes } from "@/db/schema/podcast";

// The /api/media/* and /api/podcasts/* JSON contract is snake_case: the dashboard UI,
// the POST/PATCH bodies, the CSV columns and CentenarianOS all speak it. ScopedDb
// returns raw Drizzle rows, which are camelCase, so every handler passes its rows
// through one of these serializers before responding. Returning a raw row is the
// bug that crashed Media after the first CSV import (item.media_type was undefined).
//
// Client-safe: type-only imports, so UI components can import the Api* types.

type MediaItemRow = typeof mediaItems.$inferSelect;
type MediaNoteRow = typeof mediaNotes.$inferSelect;
type MediaCategoryRow = typeof mediaCategories.$inferSelect;
type NamedCountRow = typeof mediaCreators.$inferSelect | typeof mediaPlatforms.$inferSelect;
type EpisodeRow = typeof podcastEpisodes.$inferSelect;
type EpisodeLinkRow = typeof mediaEpisodeLinks.$inferSelect;

/** Dates leave the API as ISO strings, whether the driver gave a Date or a string. */
function iso(v: Date | string): string;
function iso(v: Date | string | null): string | null;
function iso(v: Date | string | null): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : v;
}

export interface ApiMediaItem {
  id: string;
  title: string;
  creator: string | null;
  media_type: MediaItemRow["mediaType"];
  status: MediaItemRow["status"];
  rating: number | null;
  start_date: string | null;
  end_date: string | null;
  genre: string[];
  tags: string[];
  cover_image_url: string | null;
  external_url: string | null;
  category_id: string | null;
  current_progress: string | null;
  total_length: string | null;
  season_number: number | null;
  episode_number: number | null;
  total_seasons: number | null;
  total_episodes: number | null;
  visibility: MediaItemRow["visibility"];
  year_released: number | null;
  source_platform: string | null;
  notes: string | null;
  is_favorite: boolean;
  use_count: number;
  share_on_finish: boolean;
  external_source: MediaItemRow["externalSource"];
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Columns deliberately kept out of API responses (owner id, soft-delete flag). */
export const MEDIA_ITEM_PRIVATE_COLUMNS = ["userId", "isActive"] as const;

export function toApiMediaItem(row: MediaItemRow): ApiMediaItem {
  return {
    id: row.id,
    title: row.title,
    creator: row.creator,
    media_type: row.mediaType,
    status: row.status,
    rating: row.rating,
    start_date: row.startDate,
    end_date: row.endDate,
    genre: row.genre ?? [],
    tags: row.tags ?? [],
    cover_image_url: row.coverImageUrl,
    external_url: row.externalUrl,
    category_id: row.categoryId,
    current_progress: row.currentProgress,
    total_length: row.totalLength,
    season_number: row.seasonNumber,
    episode_number: row.episodeNumber,
    total_seasons: row.totalSeasons,
    total_episodes: row.totalEpisodes,
    visibility: row.visibility,
    year_released: row.yearReleased,
    source_platform: row.sourcePlatform,
    notes: row.notes,
    is_favorite: row.isFavorite,
    use_count: row.useCount,
    share_on_finish: row.shareOnFinish,
    external_source: row.externalSource,
    external_id: row.externalId,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
  };
}

export interface ApiMediaNote {
  id: string;
  media_item_id: string;
  title: string | null;
  content: string;
  content_format: MediaNoteRow["contentFormat"];
  note_type: MediaNoteRow["noteType"];
  audio_url: string | null;
  audio_public_id: string | null;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const MEDIA_NOTE_PRIVATE_COLUMNS = ["userId"] as const;

export function toApiMediaNote(row: MediaNoteRow): ApiMediaNote {
  return {
    id: row.id,
    media_item_id: row.mediaItemId,
    title: row.title,
    content: row.content,
    content_format: row.contentFormat,
    note_type: row.noteType,
    audio_url: row.audioUrl,
    audio_public_id: row.audioPublicId,
    is_public: row.isPublic,
    sort_order: row.sortOrder,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
  };
}

export interface ApiMediaCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const MEDIA_CATEGORY_PRIVATE_COLUMNS = ["userId"] as const;

export function toApiMediaCategory(row: MediaCategoryRow): ApiMediaCategory {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    sort_order: row.sortOrder,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
  };
}

/** A creator or a platform: the autocomplete caches share one shape. */
export interface ApiNamedCount {
  id: string;
  name: string;
  use_count: number;
  created_at: string;
}

export const NAMED_COUNT_PRIVATE_COLUMNS = ["userId"] as const;

export function toApiNamedCount(row: NamedCountRow): ApiNamedCount {
  return {
    id: row.id,
    name: row.name,
    use_count: row.useCount,
    created_at: iso(row.createdAt),
  };
}

export interface ApiEpisode {
  id: string;
  show_id: string | null;
  title: string;
  episode_number: number | null;
  season_number: number | null;
  air_date: string | null;
  description: string | null;
  show_notes: string | null;
  show_notes_format: EpisodeRow["showNotesFormat"];
  audio_url: string | null;
  audio_length_bytes: number | null;
  audio_mime: string | null;
  external_url: string | null;
  duration_min: number | null;
  status: EpisodeRow["status"];
  visibility: EpisodeRow["visibility"];
  artwork_url: string | null;
  show_notes_excerpt: string | null;
  published_at: string | null;
  disctopia_guid: string | null;
  created_at: string;
  updated_at: string;
}

export const EPISODE_PRIVATE_COLUMNS = ["userId", "isActive"] as const;

export function toApiEpisode(row: EpisodeRow): ApiEpisode {
  return {
    id: row.id,
    show_id: row.showId,
    title: row.title,
    episode_number: row.episodeNumber,
    season_number: row.seasonNumber,
    air_date: row.airDate,
    description: row.description,
    show_notes: row.showNotes,
    show_notes_format: row.showNotesFormat,
    audio_url: row.audioUrl,
    audio_length_bytes: row.audioLengthBytes,
    audio_mime: row.audioMime,
    external_url: row.externalUrl,
    duration_min: row.durationMin,
    status: row.status,
    visibility: row.visibility,
    artwork_url: row.artworkUrl,
    show_notes_excerpt: row.showNotesExcerpt,
    published_at: iso(row.publishedAt),
    disctopia_guid: row.disctopiaGuid,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
  };
}

export interface ApiEpisodeLink {
  id: string;
  media_item_id: string;
  episode_id: string;
  discussion_notes: string | null;
  timestamp_start: string | null;
  sort_order: number;
  created_at: string;
}

export const EPISODE_LINK_PRIVATE_COLUMNS = ["userId"] as const;

export function toApiEpisodeLink(row: EpisodeLinkRow): ApiEpisodeLink {
  return {
    id: row.id,
    media_item_id: row.mediaItemId,
    episode_id: row.episodeId,
    discussion_notes: row.discussionNotes,
    timestamp_start: row.timestampStart,
    sort_order: row.sortOrder,
    created_at: iso(row.createdAt),
  };
}

/** `tv_show` → `tv show`. Tolerates a missing value so one bad row can't crash a page. */
export function mediaTypeLabel(type: string | null | undefined): string {
  return (type ?? "").replace(/_/g, " ");
}
