import {
  type AnyPgColumn,
  boolean,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { mediaItems } from "./media";

// NEW — ReadWitUS book club (docs/03). Progress-gated, spoiler-aware discussion:
// a club_discussion post tied to milestone N is hidden/blurred for any member whose
// club_member_progress is below N. The spoiler-safe book-club mechanic (Phase 6).

export const CLUB_ROLES = ["owner", "moderator", "member"] as const;
export const CLUB_READ_STATUSES = ["upcoming", "active", "completed"] as const;

export const clubs = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  visibility: text("visibility", { enum: ["private", "public"] as const })
    .notNull()
    .default("private"),
  // Admin (moderator+) can feature a public club on the public /clubs index.
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clubMembers = pgTable(
  "club_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: CLUB_ROLES }).notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("club_members_club_user_uniq").on(t.clubId, t.userId)],
);

export const clubReads = pgTable("club_reads", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id")
    .notNull()
    .references(() => clubs.id, { onDelete: "cascade" }),
  // Either a tracked media item or a free-text book reference.
  mediaItemId: uuid("media_item_id").references(() => mediaItems.id, { onDelete: "set null" }),
  title: text("title"),
  status: text("status", { enum: CLUB_READ_STATUSES }).notNull().default("upcoming"),
  startDate: date("start_date"),
  targetEndDate: date("target_end_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clubSchedule = pgTable("club_schedule", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubReadId: uuid("club_read_id")
    .notNull()
    .references(() => clubReads.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // e.g. "Ch. 1–5"
  dueDate: date("due_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clubMemberProgress = pgTable(
  "club_member_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clubReadId: uuid("club_read_id")
      .notNull()
      .references(() => clubReads.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currentMilestoneId: uuid("current_milestone_id").references(() => clubSchedule.id, {
      onDelete: "set null",
    }),
    progressNote: text("progress_note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("club_member_progress_read_user_uniq").on(t.clubReadId, t.userId)],
);

export const clubDiscussion = pgTable("club_discussion", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubReadId: uuid("club_read_id")
    .notNull()
    .references(() => clubReads.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").references((): AnyPgColumn => clubDiscussion.id, {
    onDelete: "cascade",
  }),
  // The progress gate: a post is hidden for members below this milestone.
  milestoneId: uuid("milestone_id").references(() => clubSchedule.id, { onDelete: "set null" }),
  isSpoiler: boolean("is_spoiler").notNull().default(false),
  // Moderator takedown (soft): removed posts are hidden from members, kept for audit.
  removed: boolean("removed").notNull().default(false),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
