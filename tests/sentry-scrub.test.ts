import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { isSensitiveUrl, redactQueryString, redactSecrets, scrubEvent } from "@/lib/sentry-scrub";

// The contract this file defends: a crash report leaves the app with the crash signal intact and
// every credential removed. Each case below is a secret shape this app actually holds.

const CRON_SECRET = "cr0n-s3cret-value-not-real";
const TMDB_KEY = "abcdef0123456789abcdef0123456789";
const SESSION_COOKIE = "s3ss10n-value-not-real";

describe("isSensitiveUrl", () => {
  it("redacts the TMDB lookup URL that carries ?api_key=", () => {
    expect(
      isSensitiveUrl(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=dune`),
    ).toBe(true);
  });

  it("redacts a Better Auth magic-link callback", () => {
    expect(isSensitiveUrl("https://stream.witus.online/api/auth/magic-link/verify?token=abc")).toBe(
      true,
    );
  });

  it("redacts a Cloudinary signed-delivery URL", () => {
    expect(
      isSensitiveUrl("https://res.cloudinary.com/witus/video/upload/s--A1b2C3d4--/note.mp3"),
    ).toBe(true);
  });

  it("redacts a signed podcast playback URL (expiry + signature)", () => {
    expect(
      isSensitiveUrl("https://media.example.com/ep/12.mp3?Expires=1900000000&Signature=Zm9vYmFy"),
    ).toBe(true);
  });

  it("redacts an unparseable URL-ish string (redact when unsure)", () => {
    expect(isSensitiveUrl("https://")).toBe(true);
  });

  it("keeps a plain resource URL whose id is a UUID", () => {
    expect(
      isSensitiveUrl(
        "https://stream.witus.online/dashboard/media/3f1a9c22-5b6d-4e77-9a01-2c3d4e5f6a7b",
      ),
    ).toBe(false);
  });

  it("keeps a public episode URL", () => {
    expect(isSensitiveUrl("https://stream.witus.online/episodes?page=2")).toBe(false);
  });
});

describe("redactSecrets", () => {
  it("strips the TMDB api_key out of a fetch failure message", () => {
    const out = redactSecrets(
      `TMDB search failed: GET https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=dune 401`,
    );
    expect(out).not.toContain(TMDB_KEY);
    expect(out).toContain("[redacted url]");
    expect(out).toContain("TMDB search failed"); // the crash signal survives
  });

  it("strips a bearer cron secret", () => {
    const out = redactSecrets(`unauthorized: Authorization: Bearer ${CRON_SECRET}`);
    expect(out).not.toContain(CRON_SECRET);
    expect(out).toContain("[redacted]");
  });

  it("strips a labelled stream key and api key", () => {
    const out = redactSecrets("stream key: live_9f8e7d6c5b4a / api_key=abcdef0123456789");
    expect(out).not.toContain("live_9f8e7d6c5b4a");
    expect(out).not.toContain("abcdef0123456789");
  });

  it("strips a JWT", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(redactSecrets(`id_token=${jwt}`)).not.toContain(jwt);
  });

  it("strips the outbox HMAC signature", () => {
    const out = redactSecrets("X-Witus-Signature: sha256=0123456789abcdef0123456789abcdef");
    expect(out).not.toContain("0123456789abcdef0123456789abcdef");
  });

  it("strips email addresses", () => {
    expect(redactSecrets("club invite for member@example.com failed")).not.toContain(
      "member@example.com",
    );
  });

  it("leaves ordinary prose and public URLs alone", () => {
    const msg = "Feed fetch failed: HTTP 503 for https://stream.witus.online/feed/episodes.xml";
    expect(redactSecrets(msg)).toBe(msg);
    expect(redactSecrets("a basic understanding of the key insight")).toBe(
      "a basic understanding of the key insight",
    );
  });
});

describe("redactQueryString", () => {
  it("redacts secret-named params and keeps the rest (Sentry sends this detached from the URL)", () => {
    expect(redactQueryString("token=s3cr3t&page=2")).toBe("token=[redacted]&page=2");
    expect(redactQueryString(`api_key=${TMDB_KEY}&query=dune`)).toBe(
      "api_key=[redacted]&query=dune",
    );
    expect(redactQueryString("page=2&sort=title")).toBe("page=2&sort=title");
  });
});

describe("scrubEvent", () => {
  it("removes identity, cookies, auth headers and secrets but keeps the error", () => {
    const event = {
      message: `boom while calling https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}`,
      exception: { values: [{ type: "Error", value: "sign-in failed for bam@awews.com" }] },
      user: { id: "u_1", email: "bam@awews.com", ip_address: "203.0.113.7", username: "bam" },
      request: {
        url: "https://stream.witus.online/api/auth/magic-link/verify?token=s3cr3t-token-value",
        query_string: "token=s3cr3t-token-value",
        cookies: { "better-auth.session_token": SESSION_COOKIE },
        headers: {
          host: "stream.witus.online",
          cookie: `better-auth.session_token=${SESSION_COOKIE}`,
          authorization: `Bearer ${CRON_SECRET}`,
          "set-cookie": `better-auth.session_token=${SESSION_COOKIE}`,
          "x-witus-signature": "sha256=0123456789abcdef0123456789abcdef",
        },
      },
      breadcrumbs: [
        {
          category: "fetch",
          data: { url: `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}` },
        },
      ],
      extra: { note: `cron called with Bearer ${CRON_SECRET}` },
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);
    const serialized = JSON.stringify(out);

    for (const secret of [
      TMDB_KEY,
      CRON_SECRET,
      SESSION_COOKIE,
      "s3cr3t-token-value",
      "bam@awews.com",
      "203.0.113.7",
      "0123456789abcdef0123456789abcdef",
    ]) {
      expect(serialized).not.toContain(secret);
    }

    expect(out.user?.id).toBe("u_1"); // an opaque id is fine; it is not PII on its own
    expect(out.user?.email).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.headers).not.toHaveProperty("authorization");
    expect(out.request?.headers).toHaveProperty("host"); // still triageable
    expect(out.message).toContain("boom while calling");
  });

  it("is a no-op on an event with nothing sensitive in it", () => {
    const event = { message: "Feed fetch failed: HTTP 503" } as unknown as ErrorEvent;
    expect(scrubEvent(event).message).toBe("Feed fetch failed: HTTP 503");
  });
});
