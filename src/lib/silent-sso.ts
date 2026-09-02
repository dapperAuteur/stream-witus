/**
 * "Continue as <name>" — the silent ecosystem-SSO check, plus the derivation of the two IdP
 * endpoints it and global sign-out need.
 *
 * BAM's complaint: /signin makes you type an email even when another tab already has you signed in
 * to a WitUS app. The fix (BAM's OPTION B, 2026-08-30) is deliberately NOT automatic: render the
 * magic-link form immediately exactly as today, ask the IdP who this browser is IN PARALLEL, and if
 * an answer arrives, relabel the existing "Sign in with WitUS" button to "Continue as <name>".
 *
 * WHY A CORS PROBE AND NOT OIDC `prompt=none`. `prompt=none` is a NAVIGATION — you leave the sign-in
 * page to ask, which is the fully-automatic design BAM rejected. Asking without leaving needs a
 * hidden iframe, which Safari's ITP blocks anyway. So we ask a dedicated IdP endpoint over CORS,
 * next to a form that has already painted.
 *
 * WHAT IT BUYS AND WHAT IT DOES NOT. The probe carries the IdP's cookie as a THIRD-PARTY cookie, so
 * it answers on Chrome/Edge and returns nothing under Safari ITP or Firefox Total Cookie Protection.
 * That is the design, not a bug: a probe that answers nothing renders nothing and the visitor keeps
 * the page they already had. A failed check must be completely invisible.
 *
 * THE NAME IS DISPLAY COPY, NEVER A CREDENTIAL. It arrives from another origin, so it is
 * client-supplied by definition. Nothing here may gate access, populate a session, or be sent
 * anywhere. Clicking the button runs the REAL OIDC code flow, which is the only thing that
 * establishes identity — and this app's invite-only allow-list (`user.create.before` in auth.ts)
 * still applies to whoever comes back.
 *
 * Pure helpers: no `server-only`, no next/headers, no window access at module scope, so both the
 * client component and tests/silent-sso.test.ts can import them directly.
 */

/** Query param marking "this browser already tried the ecosystem flow on this page". */
export const SSO_ATTEMPT_PARAM = "sso";
export const SSO_ATTEMPT_VALUE = "tried";

/**
 * sessionStorage key for the same marker. Written IMMEDIATELY BEFORE we send the browser to the
 * IdP, never after it comes back: a marker written on return is a marker that never exists when the
 * return is the thing that failed.
 */
export const SSO_ATTEMPT_STORAGE_KEY = "witus.sso.attempted";

/** How long to wait for the probe before giving up. A silent check that hangs is a broken page. */
export const SILENT_SSO_TIMEOUT_MS = 4000;

/** Longest display name we will render. Caps a hostile or absurd value from blowing up the button. */
const MAX_LABEL_LENGTH = 48;

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * OIDC authorization-error codes that mean "the IdP will not finish this without a human".
 *
 * `login_required` / `interaction_required` / `consent_required` / `account_selection_required` are
 * the family a request gets back when the IdP has no usable session; `access_denied` is the one that
 * fires on the interactive path when the visitor cancels. All five share one correct response: put
 * the visitor back on /signin with no error shown. Without the interception in
 * `src/app/api/auth/[...all]/route.ts` they land on Better Auth's raw /api/auth/error page, because
 * the generic-OAuth callback redirects on `ctx.query.error` before it parses the state that carries
 * our `errorCallbackURL`.
 */
export const SILENT_AUTH_FAILURES = [
  "login_required",
  "interaction_required",
  "consent_required",
  "account_selection_required",
  "access_denied",
] as const;

export function isSilentAuthFailure(error: string | null | undefined): boolean {
  return typeof error === "string" && (SILENT_AUTH_FAILURES as readonly string[]).includes(error);
}

/** Identity shown on the button. Display only, never a credential. */
export interface SsoIdentity {
  /** What "Continue as ___" says. Already trimmed, de-controlled, and length-capped. */
  label: string;
}

export type SilentSsoSkip = "not-enabled" | "not-configured" | "already-attempted" | "already-signed-in";

export type SilentSsoDecision = { attempt: true } | { attempt: false; skip: SilentSsoSkip };

/**
 * Should this browser ask the IdP who it is?
 *
 * `enabled` is the SERVER-RESOLVED gate (`hasWitusSso`, i.e. `WITUS_OIDC_CLIENT_ID` is set) handed
 * down from the sign-in page. It is checked FIRST: if this app is not a configured OIDC client
 * there is nothing the visitor could complete, and an affordance you cannot complete is worse than
 * none. Never re-derive the gate here — a client-side default is exactly how it outlives the server
 * decision.
 */
export function silentSsoDecision(input: {
  enabled: boolean;
  endpoint: string | null | undefined;
  search?: string | null;
  attempted?: boolean;
  signedIn?: boolean;
}): SilentSsoDecision {
  if (!input.enabled) return { attempt: false, skip: "not-enabled" };
  if (!input.endpoint) return { attempt: false, skip: "not-configured" };
  if (input.signedIn) return { attempt: false, skip: "already-signed-in" };
  if (input.attempted || hasAttemptMarker(input.search)) {
    return { attempt: false, skip: "already-attempted" };
  }
  return { attempt: true };
}

/** Does this query string carry the one-shot marker? Accepts "?a=b" or "a=b". */
export function hasAttemptMarker(search: string | null | undefined): boolean {
  if (typeof search !== "string" || search === "") return false;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get(SSO_ATTEMPT_PARAM) === SSO_ATTEMPT_VALUE;
}

/** Add the one-shot marker to a same-origin path, preserving any query and hash it already has. */
export function withAttemptMarker(path: string): string {
  const [beforeHash, ...hashRest] = path.split("#");
  const hash = hashRest.length > 0 ? `#${hashRest.join("#")}` : "";
  const [pathname, ...queryRest] = beforeHash.split("?");
  const params = new URLSearchParams(queryRest.join("?"));
  params.set(SSO_ATTEMPT_PARAM, SSO_ATTEMPT_VALUE);
  return `${pathname}?${params.toString()}${hash}`;
}

/**
 * Split a discovery URL into the IdP's origin and its Better Auth basePath.
 *
 *   https://accounts.witus.online/api/idp/.well-known/openid-configuration
 *     → { origin: "https://accounts.witus.online", basePath: "/api/idp" }
 *
 * Everything below derives from this instead of naming accounts.witus.online a second time, so the
 * only external value this app asserts stays the discovery URL it is already configured with
 * (authoritative-values rule).
 */
function splitDiscoveryUrl(
  discoveryUrl: string | null | undefined,
): { origin: string; basePath: string } | null {
  if (!discoveryUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(discoveryUrl);
  } catch {
    return null;
  }
  const cut = parsed.pathname.indexOf("/.well-known/");
  if (cut < 0) return null;
  return { origin: parsed.origin, basePath: parsed.pathname.slice(0, cut) };
}

/**
 * The IdP's RP-initiated logout endpoint: `<basePath>/oauth2/endsession` — the `end_session_endpoint`
 * the live discovery document advertises.
 *
 * BAM chose GLOBAL sign-out on 2026-08-30: "signout signs out of every app". Ending only the local
 * session leaves the IdP session alive, and with "Continue as <name>" live that means signing out
 * and coming back offers to sign you straight back in, which reads as a broken logout.
 */
export function endSessionEndpointFromDiscovery(
  discoveryUrl: string | null | undefined,
): string | null {
  const parts = splitDiscoveryUrl(discoveryUrl);
  if (!parts) return null;
  return `${parts.origin}${parts.basePath}/oauth2/endsession`;
}

/**
 * The ecosystem session probe: `<idp-origin>/api/ecosystem/session`.
 *
 * NOT `<basePath>/get-session`, and this must never be "fixed" to point there. Better Auth's
 * `/get-session` returns the full `{ session, user }` and `session` carries the SESSION TOKEN, so a
 * credentialed cross-origin read of it would let any ecosystem origin — or an XSS on any one of
 * them — lift a live IdP session token. `/api/ecosystem/session` is the purpose-built endpoint in
 * gemini/witus (`app/api/ecosystem/session/route.ts`): same cookie, but it answers with a display
 * label and nothing else, and its allow-origin list comes from the IdP's own client registry (which
 * already lists `https://stream.witus.online`).
 *
 * It lives at a FIXED path on the IdP's ORIGIN, not under the Better Auth basePath.
 */
export function silentSsoEndpointFromDiscovery(
  discoveryUrl: string | null | undefined,
): string | null {
  const parts = splitDiscoveryUrl(discoveryUrl);
  if (!parts) return null;
  return `${parts.origin}/api/ecosystem/session`;
}

/**
 * Read a display name out of the probe response.
 *
 * Shapes handled: `{ signedIn, user: { name } }` (what the IdP sends), a bare user object, and every
 * "nobody is signed in" answer — `{ signedIn: false }`, a null body, a non-object. Anything else
 * yields null, which renders nothing.
 */
export function parseSilentSsoIdentity(payload: unknown): SsoIdentity | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const candidate =
    root.user && typeof root.user === "object" ? (root.user as Record<string, unknown>) : root;
  const label = cleanLabel(candidate.name) ?? cleanLabel(candidate.email);
  return label ? { label } : null;
}

/** Untrusted cross-origin text on its way to the DOM: de-control, collapse, trim, cap. */
function cleanLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_LABEL_LENGTH
    ? `${cleaned.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`
    : cleaned;
}

/** Button copy. Kept here so the test pins the exact string the visitor reads. */
export function continueAsLabel(identity: SsoIdentity | null): string {
  return identity ? `Continue as ${identity.label}` : "Sign in with WitUS";
}

/**
 * Turn a failed ecosystem callback into a quiet return to the sign-in form.
 *
 * Deliberately NARROW: only this app's own witus callback path, and only the five codes in
 * SILENT_AUTH_FAILURES, so a real fault (token-exchange failure, issuer mismatch) still surfaces the
 * way it does today rather than being swallowed into a blank sign-in page.
 *
 * The returned path carries the one-shot marker, which is the half of the loop guard that survives a
 * browser where sessionStorage throws or is empty.
 */
export function silentSsoRecoveryPath(url: URL, signInPath = "/signin"): string | null {
  if (!/\/oauth2\/callback\/witus\/?$/.test(url.pathname)) return null;
  if (!isSilentAuthFailure(url.searchParams.get("error"))) return null;
  return withAttemptMarker(signInPath);
}
