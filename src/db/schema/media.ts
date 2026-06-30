import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// Ported field-for-field from CentOS migrations 125 / 141 (docs/reports/A).
// Changes per docs/06 decisions: brand_id DROPPED (#1); external_source/external_id
// ADDED for Phase 4 auto-metadata dedup. Supabase auth.users FK → better-auth users.

export const MEDIA_TYPES = [
  "book",
  "tv_show",
  "movie",
  "video",
  "song",
  "album",
  "podcast",
  "art",
  "article",
  "other",
] as const;

export const MEDIA_STATUSES = [
  "want_to_consume",
  "in_progress",
  "completed",
  "dropped",
] as const;

export const VISIBILITIES = ["private", "public"] as const;

export const EXTERNAL_SOURCES = ["tmdb", "openlibrary", "manual"] as const;

export const mediaCategories = pgTable(
  "media_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon"),
    color: text("color").notNull().default("#8b5cf6"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("media_categories_user_name_uniq").on(t.userId, t.name)],
);

export const mediaCreators = pgTable(
  "media_creators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    useCount: integer("use_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("media_creators_user_name_uniq").on(t.userId, t.name)],
);

export const mediaPlatforms = pgTable(
  "media_platforms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    useCount: integer("use_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("media_platforms_user_name_uniq").on(t.userId, t.name)],
);

export const mediaItems = pgTable(
  "media_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    creator: text("creator"),
    mediaType: text("media_type", { enum: MEDIA_TYPES }).notNull(),
    status: text("status", { enum: MEDIA_STATUSES }).notNull().default("want_to_consume"),
    rating: smallint("rating"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    genre: text("genre")
      .array()
      .default(sql`'{}'::text[]`),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`),
    coverImageUrl: text("cover_image_url"),
    externalUrl: text("external_url"),
    categoryId: uuid("category_id").references(() => mediaCategories.id, {
      onDelete: "set null",
    }),
    currentProgress: text("current_progress"),
    totalLength: text("total_length"),
    seasonNumber: smallint("season_number"),
    episodeNumber: smallint("episode_number"),
    totalSeasons: smallint("total_seasons"),
    totalEpisodes: smallint("total_episodes"),
    visibility: text("visibility", { enum: VISIBILITIES }).notNull().default("private"),
    yearReleased: smallint("year_released"),
    sourcePlatform: text("source_platform"),
    notes: text("notes"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    useCount: integer("use_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    // Phase 7: when on, finishing this item (status→completed) fires an outbox
    // draft. Decoupled from `visibility` so public-on-profile ≠ auto-announce.
    shareOnFinish: boolean("share_on_finish").notNull().default(false),
    // NEW (docs/06 #4 / Phase 4): provenance for auto-metadata dedup + refresh.
    externalSource: text("external_source", { enum: EXTERNAL_SOURCES }),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "media_items_rating_range",
      sql`${t.rating} IS NULL OR (${t.rating} >= 1 AND ${t.rating} <= 5)`,
    ),
    // Every scoped list query filters user_id + is_active and orders by updated_at.
    index("media_items_user_active_idx").on(t.userId, t.isActive, t.updatedAt),
    index("media_items_category_idx").on(t.categoryId),
  ],
);
