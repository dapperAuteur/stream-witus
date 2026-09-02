import { z } from "zod";
import { endSessionEndpointFromDiscovery, silentSsoEndpointFromDiscovery } from "./silent-sso";

/**
 * The ecosystem IdP's discovery document, used when WITUS_OIDC_DISCOVERY_URL is unset.
 *
 * ONE literal, imported by `auth.ts` and by the two endpoint derivations below. When this lived in
 * two files they could silently disagree, and the silent check would then probe a different host
 * than the one the click actually signs in against.
 */
export const WITUS_OIDC_DISCOVERY_FALLBACK =
  "https://accounts.witus.online/api/idp/.well-known/openid-configuration";

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

  // "Sign in with WitUS" — ecosystem OIDC client against the accounts.witus.online
  // IdP. Optional: the SSO provider + button stay off until CLIENT_ID is set, so a
  // missing value never breaks the build or the magic-link flow. Provisioned per
  // plans/user-tasks (client pair here + WITUS_OIDC_SECRET__STREAM on the IdP). The
  // redirect URI the IdP expects: {BETTER_AUTH_URL}/api/auth/oauth2/callback/witus.
  WITUS_OIDC_CLIENT_ID: z.string().optional(),
  WITUS_OIDC_CLIENT_SECRET: z.string().optional(),
  WITUS_OIDC_DISCOVERY_URL: z.string().url().optional(),

  // The single product owner (personal-first v1). Used by the owner-only outbox gate.
  PRODUCT_OWNER_USER_ID: z.string().optional(),
  // The owner/admin email: the only address allowed to sign up while signups are
  // closed, and the identity that gates the admin dashboard. (Same human as
  // PRODUCT_OWNER_USER_ID.) Compared case-insensitively.
  OWNER_EMAIL: z.string().email().default("bam@awews.com"),

  // Vercel Cron auth. When set, the daily podcast auto-import endpoint requires
  // `Authorization: Bearer <CRON_SECRET>` (Vercel injects it for scheduled crons).
  CRON_SECRET: z.string().optional(),

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

  // Error monitoring: Better Stack, which ingests the standard Sentry SDK payloads (so the DSN is
  // the only thing that decides the vendor). Every runtime init is guarded on the DSN, so with these
  // unset the SDK is inert and nothing is sent. See plans/user-tasks/19-betterstack-error-monitoring-dsn.md.
  // The configs read process.env directly (they run on edge + in the browser, where this module's
  // server-side validation does not); these entries exist so the vars are documented and the admin
  // health panel can show whether monitoring is configured.
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),

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
/** True once the WitUS SSO client is provisioned — gates the provider + the button. */
export const hasWitusSso = Boolean(env.WITUS_OIDC_CLIENT_ID);
export const hasTmdb = Boolean(env.TMDB_API_KEY);
export const hasCloudinary = Boolean(
  env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
);
export const outboxEnabled = env.OUTBOX_TRIGGER_ENABLED === "true";
/** True once an error-monitoring DSN is set. Until then the Sentry/Better Stack SDK is inert. */
export const hasErrorMonitoring = Boolean(env.SENTRY_DSN ?? env.NEXT_PUBLIC_SENTRY_DSN);

/** The discovery URL actually in force — the override if set, else the ecosystem default. */
const witusDiscoveryUrl = env.WITUS_OIDC_DISCOVERY_URL ?? WITUS_OIDC_DISCOVERY_FALLBACK;

/**
 * Where /signin's silent "Continue as <name>" check asks the WitUS IdP who this browser is.
 *
 * `null` — the feature stays completely dark — unless the ecosystem OIDC client is actually
 * provisioned, because an affordance the visitor cannot complete is worse than none. The URL is
 * DERIVED from the discovery URL this app already points at, so nothing new about
 * accounts.witus.online is asserted here (see src/lib/silent-sso.ts). Resolved on the SERVER and
 * passed down as a prop: the button is a client component and must never read the raw env.
 */
export const witusSilentSsoEndpoint: string | null = hasWitusSso
  ? silentSsoEndpointFromDiscovery(witusDiscoveryUrl)
  : null;

/**
 * Where sign-out ends the SHARED WitUS session (BAM's decision, 2026-08-30: signing out of one
 * WitUS app signs you out of all of them). Dark under the same condition as the probe — with no
 * OIDC client there is no shared session to end, and sign-out stays purely local.
 *
 * `client_id` IS REQUIRED, not optional: Better Auth's endsession endpoint rejects a
 * `post_logout_redirect_uri` with `invalid_request` unless the request carries a verifiable
 * `id_token_hint` or an explicit `client_id`, and we have no id_token client-side. Baked in here so
 * the client component is handed a finished URL rather than the env var.
 */
export const witusEndSessionEndpoint: string | null = (() => {
  if (!hasWitusSso) return null;
  const base = endSessionEndpointFromDiscovery(witusDiscoveryUrl);
  if (!base) return null;
  return `${base}?client_id=${encodeURIComponent(env.WITUS_OIDC_CLIENT_ID as string)}`;
})();
