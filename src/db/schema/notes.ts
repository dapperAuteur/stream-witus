import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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

// Ported field-for-field from CentOS migrations 139 / 140 (docs/reports/A).
// `spoiler` note_type and `adaptation_of` relationship_type are the differentiators
// the whole product hangs on — preserved exactly.

export const NOTE_TYPES = [
  "general",
  "quote",
  "review",
  "podcast_prep",
  "discussion_point",
  "spoiler",
] as const;

export const CONTENT_FORMATS = ["markdown", "tiptap"] as const;

export const RELATIONSHIP_TYPES = [
  "episode_of",
  "season_of",
  "track_on",
  "created_by",
  "sequel_to",
  "adaptation_of",
  "related",
] as const;

export const mediaNotes = pgTable("media_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mediaItemId: uuid("media_item_id")
    .notNull()
    .references(() => mediaItems.id, { onDelete: "cascade" }),
  title: text("title"),
  content: text("content").notNull().default(""),
  contentFormat: text("content_format", { enum: CONTENT_FORMATS }).notNull().default("markdown"),
  noteType: text("note_type", { enum: NOTE_TYPES }).notNull().default("general"),
  audioUrl: text("audio_url"),
  audioPublicId: text("audio_public_id"),
  isPublic: boolean("is_public").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("media_notes_item_idx").on(t.mediaItemId)]);

export const mediaRelationships = pgTable(
  "media_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    childId: uuid("child_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    relationshipType: text("relationship_type", { enum: RELATIONSHIP_TYPES }).notNull(),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("media_relationships_no_self", sql`${t.parentId} <> ${t.childId}`),
    unique("media_relationships_parent_child_type_uniq").on(
      t.parentId,
      t.childId,
      t.relationshipType,
    ),
    index("media_relationships_parent_idx").on(t.parentId),
    index("media_relationships_child_idx").on(t.childId),
  ],
);
