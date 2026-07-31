import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Sentry `beforeSend` scrubber for Stream.WitUS.
 *
 * Why this file exists
 * --------------------
 * A crash report is a copy of whatever the app was holding when it broke, shipped to a third party.
 * In this app that can include real credentials:
 *   - a Better Auth magic-link URL (`/api/auth/...`), which is account takeover in a link;
 *   - the TMDB lookup URL, which carries `?api_key=` in its query string (src/lib/metadata.ts);
 *   - Cloudinary upload/delivery URLs for cover art and audio notes, including the `s--<sig>--`
 *     signed-delivery segment and the unsigned `upload_preset`;
 *   - podcast enclosure / playback URLs from the Disctopia feed, which on several media hosts are
 *     signed URLs (an expiry plus a signature in the query string);
 *   - the `Authorization: Bearer <CRON_SECRET>` header on the daily import cron, and the
 *     `X-Witus-Signature: sha256=<hmac>` header the outbox/inbox senders compute;
 *   - the owner's or a club member's email address.
 *
 * The bias is deliberate: REDACT WHEN UNSURE. An over-redacted crash report costs a click to go and
 * look at the source; an under-redacted one puts a working credential in a second, less-guarded
 * system. The one thing we go out of our way to KEEP is a plain resource URL with a UUID in it
 * (`/dashboard/media/<uuid>`): every id in this app is a `gen_random_uuid()` primary key, not a
 * bearer token, and redacting those would make every report untriageable.
 *
 * Pure and dependency-free (the Sentry import is `import type`, erased at build) so it is directly
 * unit-testable: see tests/sentry-scrub.test.ts.
 */

export const REDACTED_URL = "[redacted url]";
export const REDACTED = "[redacted]";
export const REDACTED_EMAIL = "[redacted email]";

/** Absolute http(s) URLs. Trailing punctuation is excluded so we replace the URL, not the prose. */
const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/g;

/**
 * Query-param names that carry (or plausibly carry) a bearer secret or a signed-URL grant.
 * Matched case-insensitively as a SUBSTRING, so `api_key`, `X-Amz-Signature`, `Key-Pair-Id`,
 * `access_token`, `upload_preset` and `stream_key` all trip it.
 */
const SECRET_PARAM_RE =
  /(token|secret|code|otp|passcode|password|pwd|pin|key|jwt|sig|signature|expires|policy|credential|session|magic|invite|nonce|auth|preset|hash)/i;

/** Path prefixes that are credential-redemption or credentialed endpoints by construction. */
const SECRET_PATH_RE =
  /^\/(api\/auth|api\/cron|signin|join|invite|accept|reset|reset-password|set-password|magic-link|confirm|activate|unsubscribe)(\/|$)/i;

/** Cloudinary signed-delivery segment: `.../video/upload/s--A1b2C3d4--/note.mp3`. Its presence
 *  means the URL itself is the grant, so the whole thing goes. */
const CLOUDINARY_SIGNATURE_SEGMENT_RE = /^s--[A-Za-z0-9_-]{6,}--$/;

/** A path segment that looks like a generated token: long, and drawn from the hex / base64url /
 *  nanoid alphabet. 20+ chars, because this app's own ids are UUIDs (exempted below) and its slugs
 *  are short kebab-case words. */
const TOKENISH_SEGMENT_RE = /^[A-Za-z0-9_-]{20,}$/;

/** Every id in this app is a Postgres `gen_random_uuid()`. Those are resource ids, not secrets, and
 *  keeping them is what makes a report triageable. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A JSON Web Token anywhere in free text (Better Auth / the WitUS OIDC id token). */
const JWT_RE = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]+)?/g;

/**
 * `Bearer <secret>` / `Basic <secret>` in free text or a serialized header dump. The negative
 * lookahead skips an all-letters word so ordinary prose ("basic understanding") survives, while any
 * realistic token (which contains a digit, a dash, a dot or base64 padding) is caught.
 */
const BEARER_RE = /\b(bearer|basic)\s+(?=[A-Za-z0-9._~+/=-]{8,})(?![A-Za-z]+\b)[A-Za-z0-9._~+/=-]+/gi;

/** The HMAC the outbox/inbox senders attach as `X-Witus-Signature: sha256=<hex>`. */
const HMAC_RE = /\b(sha1|sha256|sha512)=[A-Fa-f0-9]{16,}/gi;

/** Email addresses. The owner's address gates admin; a member's is personal data either way. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * A raw secret that is NOT a URL: `api_key = abc123`, `stream key: live_xxx`, `token=...`.
 * The separator (`is` / `:` / `=`) is REQUIRED. Without it "the key insight" would be mangled in
 * every report, and there is no format in which we would ship a secret with no separator at all.
 * Group 2 is the optional quote, backreferenced as `\2` so a quoted value closes properly.
 */
const SECRET_LABEL_RE =
  /\b(stream[-_\s]?key|api[-_\s]?key|secret|password|passcode|pin|dsn|token|key|signature|access[-_\s]?token|refresh[-_\s]?token|client[-_\s]?secret|cron[-_\s]?secret|auth[-_\s]?token|upload[-_\s]?preset|one[-\s]?time code|verification code)\b\s*(?:is|:|=)\s*(["']?)([^\s"',;]{3,})\2/gi;

/**
 * Is this URL carrying a secret that must never leave the app?
 *
 * Returns TRUE (redact) for anything unparseable: an unparseable URL is exactly the case where we
 * cannot reason about it, and the rule is "redact when unsure".
 */
export function isSensitiveUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return true; // cannot reason about it, so do not ship it
  }

  // Any query param that names a secret or a signed-URL grant. TMDB's `?api_key=` and a signed
  // media URL's `?Expires=&Signature=` both land here.
  for (const key of url.searchParams.keys()) {
    if (SECRET_PARAM_RE.test(key)) return true;
  }

  if (SECRET_PATH_RE.test(url.pathname)) return true;

  return url.pathname.split("/").some((seg) => {
    if (CLOUDINARY_SIGNATURE_SEGMENT_RE.test(seg)) return true;
    if (UUID_RE.test(seg)) return false; // a resource id: keep it
    return TOKENISH_SEGMENT_RE.test(seg);
  });
}

/**
 * Remove every bearer secret, signed-URL grant and email address from a string. Sensitive URLs
 * become `[redacted url]`, tokens and labelled secrets become `[redacted]`, emails become
 * `[redacted email]`. Everything else survives, so the message still reads as the error it was.
 */
export function redactSecrets(text: string): string {
  let out = text.replace(URL_RE, (match) => (isSensitiveUrl(match) ? REDACTED_URL : match));
  out = out.replace(JWT_RE, REDACTED);
  out = out.replace(BEARER_RE, (_match, scheme: string) => `${scheme} ${REDACTED}`);
  out = out.replace(HMAC_RE, (_match, algo: string) => `${algo}=${REDACTED}`);
  out = out.replace(EMAIL_RE, REDACTED_EMAIL);
  out = out.replace(
    SECRET_LABEL_RE,
    (match: string, label: string, _quote: string, value: string) =>
      value.startsWith("[redacted") ? match : `${label}: ${REDACTED}`,
  );
  return out;
}

/**
 * Redact a bare query string (`token=abc&page=2`). Sentry sends this as its own field, detached from
 * the URL, so the URL rules above never see it: it needs its own pass or a magic-link token walks
 * straight out in `request.query_string`.
 */
export function redactQueryString(qs: string): string {
  return qs
    .split("&")
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq < 0) return pair;
      const name = pair.slice(0, eq);
      return SECRET_PARAM_RE.test(name) ? `${name}=${REDACTED}` : pair;
    })
    .join("&");
}

const scrub = (s: string | undefined): string | undefined => (s ? redactSecrets(s) : s);

/**
 * Sentry `beforeSend`. Strips the account identity, the network origin, the cookies and the auth
 * headers, then runs every remaining free-text field through `redactSecrets`. It never returns
 * null: we still want the crash signal, just with the credentials taken out of it.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.message) event.message = scrub(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrub(ex.value);
  }

  // Never ship the account identity or the network origin.
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  // Request context: keep a scrubbed URL for triage, drop the credential-bearing parts outright.
  if (event.request) {
    if (typeof event.request.url === "string") event.request.url = scrub(event.request.url);
    if (typeof event.request.query_string === "string") {
      event.request.query_string = redactSecrets(redactQueryString(event.request.query_string));
    }
    delete event.request.cookies;
    const headers = event.request.headers as Record<string, string> | undefined;
    if (headers) {
      delete headers.cookie;
      delete headers.authorization;
      delete headers["set-cookie"];
      delete headers["x-witus-signature"];
    }
  }

  // Breadcrumbs are the sleeper leak here: the browser SDK auto-records every fetch/XHR URL, which
  // in this app includes the Cloudinary upload call and the metadata lookup behind `?api_key=`.
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrub(crumb.message);
    const data = crumb.data as Record<string, unknown> | undefined;
    if (data && typeof data.url === "string") data.url = redactSecrets(data.url);
  }

  // Anything the app attached by hand.
  if (event.extra) {
    for (const [key, value] of Object.entries(event.extra)) {
      if (typeof value === "string") event.extra[key] = redactSecrets(value);
    }
  }

  return event;
}
