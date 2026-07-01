import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// better-auth core tables (drizzle adapter, usePlural). Magic-link only — no
// password/passkey/2FA. Column names align with better-auth's expected schema.
// `media_items.user_id`, `clubs.owner_user_id`, etc. FK `users.id`. Replaces
// CentOS's Supabase `auth.users`.

// Admin role tier (owner-granted). Owner (env OWNER_EMAIL) sits above all and is
// implicit — never stored. Capability order: none < monitor < moderator < admin.
//   monitor   — view the admin dashboard; change nothing
//   moderator — monitor + content moderation (episode unpublish, remove a post, feature a club)
//   admin     — everything EXCEPT managing roles/users (that's owner-only)
export const ADMIN_ROLES = ["none", "monitor", "moderator", "admin"] as const;

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  adminRole: text("admin_role", { enum: ADMIN_ROLES }).notNull().default("none"),
  // Deactivated → blocked from signing in (sessions killed). The owner can never
  // be deactivated/demoted (enforced in the admin routes).
  deactivated: boolean("deactivated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
