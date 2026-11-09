/**
 * "Sign in and come back" (witus docs/shared-ui-ux-dx.md, "Every 4xx and 5xx is handled
 * gracefully": a 401 sends the visitor to sign in and back to where they were).
 *
 * The protected path travels as `/signin?next=<path>`. Anything read back from the query string
 * is untrusted, so it is only ever used through `safeReturnPath`, which accepts a same-origin
 * absolute path and nothing else. An open redirect here would turn our sign-in page into a
 * phishing relay, so the rules are deliberately narrow. Pure helpers: no window, no React.
 */

export const RETURN_PARAM = "next";

/** Where a sign-in lands when no (valid) return path was given. */
export const DEFAULT_RETURN_PATH = "/dashboard/media";

/** Request header the proxy sets so a server layout knows which path it is guarding. */
export const PATH_HEADER = "x-stream-path";

/**
 * The value as a same-origin path, or `fallback`.
 *
 * Accepted: a string starting with a single "/" (for example "/dashboard/clubs/abc?tab=2").
 * Refused: protocol-relative "//evil.example", backslash tricks ("/\\evil.example", which some
 * browsers normalize to "//"), anything with a scheme, control characters, and paths that would
 * bounce back into the sign-in page itself (a loop) or into the auth API.
 */
export function safeReturnPath(raw: unknown, fallback: string = DEFAULT_RETURN_PATH): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  const pathname = value.split(/[?#]/)[0];
  if (pathname === "/signin" || pathname.startsWith("/signin/")) return fallback;
  if (pathname.startsWith("/api/")) return fallback;
  return value;
}

/** The sign-in URL that returns to `path` afterward (or plain /signin when there is none). */
export function signInHref(path: string | null | undefined): string {
  const safe = safeReturnPath(path, "");
  if (!safe || safe === DEFAULT_RETURN_PATH) return "/signin";
  return `/signin?${RETURN_PARAM}=${encodeURIComponent(safe)}`;
}
