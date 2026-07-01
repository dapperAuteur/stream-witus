import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Signup gating + a small key-value store the owner manages from the admin
// dashboard. Only the OWNER_EMAIL may sign up while `signups_open` is off; every
// other email lands on the waitlist until approved (or signups are opened).

export const WAITLIST_STATUSES = ["waiting", "approved"] as const;

export const waitlist = pgTable("waitlist", {
  email: text("email").primaryKey(), // stored lowercase (see access.ts)
  status: text("status", { enum: WAITLIST_STATUSES }).notNull().default("waiting"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Owner-managed flags/settings. e.g. key='signups_open', value='true'|'false';
// 'outbox_enabled', 'outbox_trigger_<name>'.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const INBOX_STATUSES = ["new", "read", "archived"] as const;

// A LOCAL mirror of every inbound form (contact/pitch/waitlist) so the owner can
// triage inline in admin, in addition to the forward to witus-inbox.
export const inboxSubmissions = pgTable("inbox_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  formType: text("form_type").notNull(),
  name: text("name"),
  email: text("email"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  status: text("status", { enum: INBOX_STATUSES }).notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Content-free record of outbox attempts (iron rule: never caption/secret/sig —
// only source/platform/external_ref/http_status). Powers the admin activity view.
export const outboxLog = pgTable("outbox_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  platform: text("platform").notNull(),
  externalRef: text("external_ref").notNull(),
  httpStatus: integer("http_status"),
  ok: boolean("ok").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
