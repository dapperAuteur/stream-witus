import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

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

// Owner-managed flags/settings. e.g. key='signups_open', value='true'|'false'.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
