import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3050"),

  // Neon Postgres. Pooled for runtime; unpooled for migrations (falls back to pooled).
  // In this project the URLs arrive STORAGE_-prefixed (see resolveDbUrl / firstEnv below).
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),

  // Better Auth (magic-link)
  BETTER_AUTH_SECRET: z.string().min(32),
  // Canonical app base. Dev: http://localhost:3050. Prod: https://stream.witus.online.
  BETTER_AUTH_URL: z.string().url(),
  // Extra comma-separated origins to trust for auth.
  TRUSTED_ORIGINS: z.string().optional(),
  // The single product owner (personal-first v1). Used by the owner-only outbox gate.
  PRODUCT_OWNER_USER_ID: z.string().optional(),

  // Email (Mailgun) — magic-link delivery.
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),
  MAILGUN_REGION: z.enum(["us", "eu"]).default("us"),
  MAIL_FROM: z.string().default("Stream.WitUS <no-reply@witus.online>"),

  // External metadata APIs (Phase 4). Open Library needs no key.
  TMDB_API_KEY: z.string().optional(),

  // Cloudinary (covers + audio notes; docs/06 #4). Optional — URL-only works without.
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Ecosystem outbox (Phase 7) — social drafts. Off until OUTBOX_TRIGGER_ENABLED=true.
  OUTBOX_INGEST_URL: z.string().url().optional(),
  OUTBOX_SOURCE_SLUG: z.string().optional(),
  OUTBOX_INGEST_SECRET: z.string().optional(),
  OUTBOX_TRIGGER_ENABLED: z.string().optional(),

  // Ecosystem inbox (Phase 7) — contact + newsletter forms.
  INBOX_INGEST_URL: z.string().url().optional(),
  INBOX_SOURCE_SLUG: z.string().optional(),
  INBOX_INGEST_SECRET: z.string().optional(),
});

const isProd = process.env.NODE_ENV === "production";
// `next build` runs with NODE_ENV=production but is not a live runtime; allow
// placeholders so a build (and CI typecheck) never needs real secrets.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
const allowDevDefaults = !isProd || isBuildPhase;

const devPlaceholders = {
  DATABASE_URL: "postgres://placeholder:placeholder@localhost/stream_witus_dev",
  BETTER_AUTH_SECRET: "dev-secret-minimum-32-characters-xxxxxxxxxxxx",
  BETTER_AUTH_URL: "http://localhost:3050",
} as const;

// This project's Vercel–Neon integration provisions the connection string under
// STORAGE_-prefixed names; accept those plus the plain / POSTGRES_ forms so a
// deploy works whether the URL was set by hand or by the integration.
const firstEnv = (...names: string[]): string | undefined => {
  for (const n of names) if (process.env[n]) return process.env[n];
  return undefined;
};
const pooledDbUrl = firstEnv(
  "STORAGE_DATABASE_URL",
  "DATABASE_URL",
  "STORAGE_POSTGRES_URL",
  "POSTGRES_URL",
);
const unpooledDbUrl =
  firstEnv(
    "STORAGE_DATABASE_URL_UNPOOLED",
    "DATABASE_URL_UNPOOLED",
    "STORAGE_POSTGRES_URL_NON_POOLING",
    "POSTGRES_URL_NON_POOLING",
  ) ?? pooledDbUrl;

const input = {
  ...process.env,
  DATABASE_URL: pooledDbUrl ?? (allowDevDefaults ? devPlaceholders.DATABASE_URL : undefined),
  DATABASE_URL_UNPOOLED: unpooledDbUrl,
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ??
    (allowDevDefaults ? devPlaceholders.BETTER_AUTH_SECRET : undefined),
  BETTER_AUTH_URL:
    process.env.BETTER_AUTH_URL ?? (allowDevDefaults ? devPlaceholders.BETTER_AUTH_URL : undefined),
};

const parsed = schema.safeParse(input);
if (!parsed.success) {
  const fields = parsed.error.flatten().fieldErrors;
  throw new Error(
    `Invalid environment variables:\n${JSON.stringify(fields, null, 2)}\n` +
      "On Vercel, set these in Project → Settings → Environment Variables. The DB URL may arrive as " +
      "STORAGE_DATABASE_URL / STORAGE_POSTGRES_URL from the Neon integration — all are accepted; if " +
      "none is present this error is shown.",
  );
}

export const env = parsed.data;

/** True once the DB points at a real Neon instance (not the dev placeholder). */
export const hasDatabase = !env.DATABASE_URL.includes("placeholder");
export const hasMailgun = Boolean(env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN);
export const hasTmdb = Boolean(env.TMDB_API_KEY);
export const hasCloudinary = Boolean(
  env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
);
export const outboxEnabled = env.OUTBOX_TRIGGER_ENABLED === "true";
