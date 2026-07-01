import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { mediaItems } from "./media";

// "All The Spoilers" show planning. Ported from CentOS (docs/reports/A); brand_id
// DROPPED (docs/06 #1). media_episode_links carries timestamp_start so a title can
// be tied to the exact moment in an episode (the podcast-companion differentiator).

export const SHOW_NOTES_FORMATS = ["markdown", "tiptap"] as const;
export const EPISODE_STATUSES = ["draft", "recorded", "published"] as const;

// Multi-show discriminator (plans/04). Each show carries its own Outbox slug/secret
// env keys + default artwork + Disctopia feed URL. Seeded with all-the-spoilers /
// wfc / aamsaz by scripts/seed-shows.ts.
export const podcastShows = pgTable("podcast_shows", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  artworkUrl: text("artwork_url"),
  feedUrl: text("feed_url"),
  outboxSlugEnvKey: text("outbox_slug_env_key"),
  outboxSecretEnvKey: text("outbox_secret_env_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const podcastEpisodes = pgTable("podcast_episodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Which show this episode belongs to (plans/04). Nullable for the additive
  // migration; existing rows backfill to all-the-spoilers.
  showId: uuid("show_id").references(() => podcastShows.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  episodeNumber: integer("episode_number"),
  seasonNumber: integer("season_number"),
  airDate: date("air_date"),
  description: text("description"),
  showNotes: text("show_notes"),
  showNotesFormat: text("show_notes_format", { enum: SHOW_NOTES_FORMATS })
    .notNull()
    .default("markdown"),
  audioUrl: text("audio_url"),
  externalUrl: text("external_url"),
  durationMin: integer("duration_min"),
  status: text("status", { enum: EPISODE_STATUSES }).notNull().default("draft"),
  // public show-note pages key off visibility (docs/06 #5).
  visibility: text("visibility", { enum: ["private", "public"] as const })
    .notNull()
    .default("private"),
  isActive: boolean("is_active").notNull().default(true),
  // Podcast-publishing fields absorbed from witus.online (plans/03/04).
  artworkUrl: text("artwork_url"),
  showNotesExcerpt: text("show_notes_excerpt"), // used by the outbox caption
  publishedAt: timestamp("published_at", { withTimezone: true }),
  // RSS idempotency: the Disctopia <guid>. Null for manually-created episodes;
  // UNIQUE across non-null rows so re-import dedupes.
  disctopiaGuid: text("disctopia_guid").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediaEpisodeLinks = pgTable(
  "media_episode_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mediaItemId: uuid("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => podcastEpisodes.id, { onDelete: "cascade" }),
    discussionNotes: text("discussion_notes"),
    timestampStart: text("timestamp_start"), // e.g. "00:15:30"
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("media_episode_links_item_episode_uniq").on(t.mediaItemId, t.episodeId),
    index("media_episode_links_episode_idx").on(t.episodeId),
  ],
);
