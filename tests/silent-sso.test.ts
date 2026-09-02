import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SILENT_AUTH_FAILURES,
  SSO_ATTEMPT_STORAGE_KEY,
  continueAsLabel,
  endSessionEndpointFromDiscovery,
  hasAttemptMarker,
  isSilentAuthFailure,
  parseSilentSsoIdentity,
  silentSsoDecision,
  silentSsoEndpointFromDiscovery,
  silentSsoRecoveryPath,
  withAttemptMarker,
} from "@/lib/silent-sso";

/**
 * The silent ecosystem-SSO check ("Continue as <name>") and global sign-out.
 *
 * Pinned in order of what each would cost if it broke:
 *   1. THE REDIRECT LOOP. probe → "Continue as X" → click → IdP declines → back to /signin → probe.
 *      It never appears in normal use, so it is simulated end to end below.
 *   2. SIGN-OUT ORDERING. The local session must die BEFORE the hand-off to the IdP, or an
 *      unreachable IdP means "I clicked sign out and I'm still signed in".
 *   3. INVISIBLE FAILURE. Nothing the probe can return may produce an error, a stuck spinner, or a
 *      claim about who the visitor is — and the name it returns must never be treated as identity.
 *   4. THE GATE. Neither feature may do anything when this app is not a configured OIDC client.
 *
 * Several assertions read source text. That is deliberate: the properties above are about ORDER and
 * ABSENCE, which a unit test of the exported helpers cannot observe.
 */

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

/** Assertions about what the CODE does must not be satisfied (or broken) by a comment. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ENDPOINT = "https://accounts.witus.online/api/ecosystem/session";
const DISCOVERY = "https://accounts.witus.online/api/idp/.well-known/openid-configuration";

describe("the gate: neither feature does anything without a configured OIDC client", () => {
  it("refuses when disabled, no matter what else is true", () => {
    for (const search of ["", "?sso=tried"]) {
      for (const attempted of [false, true]) {
        for (const signedIn of [false, true]) {
          expect(
            silentSsoDecision({ enabled: false, endpoint: ENDPOINT, search, attempted, signedIn }),
          ).toEqual({ attempt: false, skip: "not-enabled" });
        }
      }
    }
  });

  it("attempts when enabled, configured, and this is a clean first visit", () => {
    expect(silentSsoDecision({ enabled: true, endpoint: ENDPOINT, search: "" })).toEqual({
      attempt: true,
    });
  });

  it("stays dark when ecosystem SSO is not configured", () => {
    for (const endpoint of [null, undefined, ""]) {
      expect(silentSsoDecision({ enabled: true, endpoint, search: "" })).toEqual({
        attempt: false,
        skip: "not-configured",
      });
    }
  });

  it("does not ask on behalf of someone already signed in", () => {
    expect(silentSsoDecision({ enabled: true, endpoint: ENDPOINT, signedIn: true })).toEqual({
      attempt: false,
      skip: "already-signed-in",
    });
  });

  it("is enforced by the server page, which resolves the endpoint and the flag", () => {
    const page = read("src/app/signin/page.tsx");
    expect(page).toContain("import { hasWitusSso, witusSilentSsoEndpoint } from '@/lib/env';");
    expect(page).toContain(
      "<SignInForm witusSsoEnabled={hasWitusSso} witusSilentCheckUrl={witusSilentSsoEndpoint} />",
    );
    // The form only mounts the button behind the same flag, so a dark app never ships the URL.
    const form = read("src/app/signin/SignInForm.tsx");
    const gated = form.slice(form.indexOf("{witusSsoEnabled ?"));
    expect(gated).toContain(
      "<WitusSsoButton enabled={witusSsoEnabled} silentCheckUrl={witusSilentCheckUrl} />",
    );
    expect(form.split("<WitusSsoButton").length - 1).toBe(1);
  });

  it("is repeated as a hard precondition inside the component", () => {
    const component = read("src/components/witus-sso-button.tsx");
    // A caller who forgets the wrapper gets a dark button, not a request to the IdP.
    expect(component).toContain("if (!enabled) return null;");
    // Exactly one network call, and the decision function is what guards it.
    expect(component.split("fetch(").length - 1).toBe(1);
    const effect = component.slice(
      component.indexOf("useEffect(() => {"),
      component.indexOf("fetch("),
    );
    expect(effect).toContain("silentSsoDecision({");
    expect(effect).toContain("if (!decision.attempt || !endpoint) return;");
  });

  it("only ever asks the server-resolved endpoint, never one it builds itself", () => {
    // Comments may name the IdP; CODE must not. A URL literal here would be a client-side default
    // that could outlive the server's gate.
    const code = stripComments(read("src/components/witus-sso-button.tsx"));
    expect(code).not.toContain("https://");
    expect(code).not.toContain("witus.online");
    expect(code).toContain("const endpoint = silentCheckUrl;");
    expect(code).toContain("fetch(endpoint,");
  });

  it("resolves both IdP endpoints on the server, behind hasWitusSso", () => {
    const env = stripComments(read("src/lib/env.ts"));
    expect(env).toContain("export const witusSilentSsoEndpoint: string | null = hasWitusSso");
    expect(env).toContain("if (!hasWitusSso) return null;");
    // client_id is REQUIRED: Better Auth rejects post_logout_redirect_uri with invalid_request
    // unless the request carries a verifiable id_token_hint or an explicit client_id.
    expect(env).toContain("?client_id=${encodeURIComponent(env.WITUS_OIDC_CLIENT_ID as string)}");
  });
});

describe("the redirect loop: simulating an IdP that will not sign the visitor in", () => {
  /**
   * The failure this guard exists for, walked start to finish. It cannot be reproduced by using the
   * app normally, because in normal use the IdP either has a session or shows its own login page.
   */
  it("attempts once, then never again in that tab", () => {
    // 1. First arrival: no marker anywhere.
    let storage = false;
    let search = "";
    expect(
      silentSsoDecision({ enabled: true, endpoint: ENDPOINT, search, attempted: storage }),
    ).toEqual({ attempt: true });

    // 2. The probe answered, the visitor clicked, and the marker is written BEFORE the redirect.
    storage = true;

    // 3. The IdP declines. This is what comes back to our callback.
    const declined = new URL(
      "https://stream.witus.online/api/auth/oauth2/callback/witus?error=login_required&error_description=Authentication+required",
    );
    const recovery = silentSsoRecoveryPath(declined);
    expect(recovery).toBe("/signin?sso=tried");
    search = new URL(recovery as string, "https://stream.witus.online").search;

    // 4. Back on /signin. Both halves of the marker now say stop.
    expect(
      silentSsoDecision({ enabled: true, endpoint: ENDPOINT, search, attempted: storage }),
    ).toEqual({ attempt: false, skip: "already-attempted" });

    // 5. sessionStorage alone stops it (the visitor navigated back to a bare /signin).
    expect(
      silentSsoDecision({ enabled: true, endpoint: ENDPOINT, search: "", attempted: true }),
    ).toEqual({ attempt: false, skip: "already-attempted" });

    // 6. The query param alone stops it — the case that matters where sessionStorage throws or is
    //    empty (private mode, a fresh tab from the redirect).
    expect(
      silentSsoDecision({ enabled: true, endpoint: ENDPOINT, search, attempted: false }),
    ).toEqual({ attempt: false, skip: "already-attempted" });
  });

  it("writes the marker BEFORE redirecting, never after the return", () => {
    const component = read("src/components/witus-sso-button.tsx");
    const write = component.indexOf("writeAttempted();");
    const redirect = component.indexOf("authClient.signIn");
    expect(write).toBeGreaterThan(-1);
    expect(redirect).toBeGreaterThan(-1);
    // A marker written after the redirect never exists when the return is the thing that failed —
    // which is precisely the loop.
    expect(write).toBeLessThan(redirect);
    expect(component).toContain("SSO_ATTEMPT_STORAGE_KEY");
    // The key lives in the shared module, so the component and the tests cannot drift.
    expect(SSO_ATTEMPT_STORAGE_KEY).toBe("witus.sso.attempted");
    // Both sessionStorage accesses are wrapped: it throws outright in some privacy modes.
    const helpers = component.slice(component.indexOf("function readAttempted"));
    expect(helpers.split("try {").length - 1).toBe(2);
  });

  it("recovers only from declines, and only from this app's own witus callback", () => {
    const base = "https://stream.witus.online";
    for (const code of SILENT_AUTH_FAILURES) {
      expect(
        silentSsoRecoveryPath(new URL(`${base}/api/auth/oauth2/callback/witus?error=${code}`)),
      ).toBe("/signin?sso=tried");
    }
    // A real fault must still surface the way it does today.
    expect(
      silentSsoRecoveryPath(new URL(`${base}/api/auth/oauth2/callback/witus?error=server_error`)),
    ).toBeNull();
    // A success must never be swallowed.
    expect(
      silentSsoRecoveryPath(new URL(`${base}/api/auth/oauth2/callback/witus?code=abc&state=xyz`)),
    ).toBeNull();
    // Another provider, and every other auth route, are untouched — magic link above all.
    expect(
      silentSsoRecoveryPath(new URL(`${base}/api/auth/oauth2/callback/other?error=login_required`)),
    ).toBeNull();
    expect(silentSsoRecoveryPath(new URL(`${base}/api/auth/get-session`))).toBeNull();
    expect(silentSsoRecoveryPath(new URL(`${base}/api/auth/magic-link/verify?token=t`))).toBeNull();
  });

  it("is wired into the auth route ahead of Better Auth", () => {
    const route = read("src/app/api/auth/[...all]/route.ts");
    const guard = route.indexOf("silentSsoRecoveryPath(");
    const delegate = route.indexOf("handlers.GET(request)");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(delegate);
    expect(route).toContain("headers: { location: recovery }");
    // POST (magic link, sign-out) must pass through completely untouched.
    expect(route).toContain("export const POST = handlers.POST;");
  });

  it("classifies the OIDC decline codes and nothing else", () => {
    expect(isSilentAuthFailure("login_required")).toBe(true);
    expect(isSilentAuthFailure("interaction_required")).toBe(true);
    expect(isSilentAuthFailure("access_denied")).toBe(true);
    expect(isSilentAuthFailure("invalid_request")).toBe(false);
    expect(isSilentAuthFailure("")).toBe(false);
    expect(isSilentAuthFailure(null)).toBe(false);
    expect(isSilentAuthFailure(undefined)).toBe(false);
  });
});

describe("the one-shot marker", () => {
  it("reads only its own exact value", () => {
    expect(hasAttemptMarker("?sso=tried")).toBe(true);
    expect(hasAttemptMarker("sso=tried")).toBe(true);
    expect(hasAttemptMarker("?from=email&sso=tried")).toBe(true);
    expect(hasAttemptMarker("?sso=something-else")).toBe(false);
    expect(hasAttemptMarker("?next=/sso=tried")).toBe(false);
    expect(hasAttemptMarker("")).toBe(false);
    expect(hasAttemptMarker(null)).toBe(false);
    expect(hasAttemptMarker(undefined)).toBe(false);
  });

  it("keeps any query and hash the path already carried", () => {
    expect(withAttemptMarker("/signin")).toBe("/signin?sso=tried");
    expect(withAttemptMarker("/signin?from=email")).toBe("/signin?from=email&sso=tried");
    expect(withAttemptMarker("/signin#top")).toBe("/signin?sso=tried#top");
  });

  it("is idempotent, so a second pass cannot stack duplicates", () => {
    const once = withAttemptMarker("/signin?from=email");
    expect(withAttemptMarker(once)).toBe(once);
  });
});

describe("the endpoints are derived, never invented", () => {
  it("turns the configured discovery URL into the IdP's session route", () => {
    expect(silentSsoEndpointFromDiscovery(DISCOVERY)).toBe(ENDPOINT);
    // The probe lives at a FIXED path on the IdP's ORIGIN, not under its Better Auth basePath, so
    // an IdP mounted at the root derives the same route.
    expect(
      silentSsoEndpointFromDiscovery("https://id.example.test/.well-known/openid-configuration"),
    ).toBe("https://id.example.test/api/ecosystem/session");
  });

  it("never probes Better Auth's /get-session, which would expose a session token", () => {
    // THE POINT OF THIS TEST. /get-session returns { session, user } and `session` carries the
    // SESSION TOKEN, so a credentialed cross-origin read of it would let any ecosystem origin — or
    // an XSS on one — lift a live IdP session token. If someone "fixes" the probe by re-deriving
    // that path, this fails.
    for (const discovery of [
      DISCOVERY,
      "https://id.example.test/.well-known/openid-configuration",
    ]) {
      expect(silentSsoEndpointFromDiscovery(discovery)).not.toContain("get-session");
    }
  });

  it("derives the RP-initiated logout endpoint under the IdP's basePath", () => {
    // Unlike the probe, end_session DOES live under the Better Auth basePath.
    expect(endSessionEndpointFromDiscovery(DISCOVERY)).toBe(
      "https://accounts.witus.online/api/idp/oauth2/endsession",
    );
    expect(endSessionEndpointFromDiscovery(null)).toBeNull();
    expect(endSessionEndpointFromDiscovery("not a url")).toBeNull();
  });

  it("returns null rather than guessing when there is nothing to derive from", () => {
    for (const bad of [null, undefined, "", "not a url", "https://accounts.witus.online/api/idp"]) {
      expect(silentSsoEndpointFromDiscovery(bad)).toBeNull();
    }
  });

  it("names the IdP discovery URL exactly once, in a constant both consumers share", () => {
    // Two files used to carry this literal. If they ever disagreed, the silent check would probe a
    // different host than the one the click actually signs in against.
    const envSrc = read("src/lib/env.ts");
    expect(envSrc).toContain(`export const WITUS_OIDC_DISCOVERY_FALLBACK =\n  "${DISCOVERY}";`);
    const authSrc = read("src/lib/auth.ts");
    expect(authSrc).toContain("WITUS_OIDC_DISCOVERY_FALLBACK");
    expect(stripComments(authSrc)).not.toContain("openid-configuration");
  });
});

describe("reading the probe answer", () => {
  it("finds the name in the IdP's response shape", () => {
    expect(
      parseSilentSsoIdentity({ signedIn: true, user: { name: "Brand Anthony McDonald" } }),
    ).toEqual({ label: "Brand Anthony McDonald" });
  });

  it("accepts a bare user object and falls back to the email", () => {
    expect(parseSilentSsoIdentity({ name: "Ada", email: "ada@example.test" })).toEqual({
      label: "Ada",
    });
    expect(parseSilentSsoIdentity({ user: { name: "", email: "ada@example.test" } })).toEqual({
      label: "ada@example.test",
    });
  });

  it("returns nothing for every shape that means nobody is signed in", () => {
    expect(parseSilentSsoIdentity({ signedIn: false })).toBeNull();
    expect(parseSilentSsoIdentity(null)).toBeNull();
    expect(parseSilentSsoIdentity(undefined)).toBeNull();
    expect(parseSilentSsoIdentity({})).toBeNull();
    expect(parseSilentSsoIdentity({ user: null })).toBeNull();
    expect(parseSilentSsoIdentity({ user: { id: "u1" } })).toBeNull();
    expect(parseSilentSsoIdentity("Ada")).toBeNull();
    expect(parseSilentSsoIdentity(42)).toBeNull();
    expect(parseSilentSsoIdentity([{ name: "Ada" }])).toBeNull();
  });

  it("cleans a name it did not author before putting it on a button", () => {
    // It crosses an origin boundary, so it is untrusted input even though it is only display copy.
    expect(parseSilentSsoIdentity({ name: "  Ada  Lovelace " })).toEqual({ label: "Ada Lovelace" });
    expect(parseSilentSsoIdentity({ name: "Ada\u0000\u001BLovelace" })).toEqual({
      label: "AdaLovelace",
    });
    expect(parseSilentSsoIdentity({ name: "   " })).toBeNull();
    const long = parseSilentSsoIdentity({ name: "N".repeat(300) });
    expect(long?.label.length).toBeLessThanOrEqual(48);
  });

  it("says the right thing in both states", () => {
    expect(continueAsLabel(null)).toBe("Sign in with WitUS");
    expect(continueAsLabel({ label: "Ada" })).toBe("Continue as Ada");
  });
});

describe("a failed check is invisible", () => {
  it("swallows every probe outcome and never renders an error", () => {
    const component = read("src/components/witus-sso-button.tsx");
    expect(component).toContain(".catch(() => {");
    // No error state to render, and no loading state that could hang: the button is fully usable
    // from first paint and only ever gains a better label.
    expect(component).not.toMatch(/useState[^\n]*[Ee]rror/);
    expect(component).not.toMatch(/useState[^\n]*[Ll]oading/);
    // The probe cannot hang the page open forever.
    expect(component).toContain("SILENT_SSO_TIMEOUT_MS");
    expect(component).toContain("controller.abort()");
  });
});

describe("global sign-out", () => {
  const button = read("src/components/SignOutButton.tsx");

  it("destroys the local session BEFORE handing off to the IdP", () => {
    // THE SAFETY PROPERTY. If the IdP is unreachable or refuses, the person is still signed out
    // here. Reversing these two lines turns any IdP failure into "I clicked sign out and I'm still
    // signed in" — which is why the order is pinned rather than left to review.
    const local = button.indexOf("await signOut();");
    const handoff = button.indexOf("window.location.assign(");
    expect(local).toBeGreaterThan(-1);
    expect(handoff).toBeGreaterThan(-1);
    expect(local).toBeLessThan(handoff);
  });

  it("sends post_logout_redirect_uri with the trailing slash the IdP registered", () => {
    // Better Auth exact-matches this against the client's registered redirectUrls, and the registry
    // (gemini/witus lib/identity/clients.ts) registers `origin + "/"`. Drop the slash → 400.
    expect(button).toContain("const back = `${window.location.origin}/`;");
    expect(button).toContain("&post_logout_redirect_uri=${encodeURIComponent(back)}");
    // A full navigation, not a router push: this leaves our origin.
    expect(stripComments(button)).not.toContain("router.push('/')");
  });

  it("stays local, and says so, when this app is not a configured OIDC client", () => {
    expect(button).toContain("endSessionUrl = null");
    expect(button).toContain("if (endSessionUrl) {");
    expect(button).toContain("router.push('/signin');");
    expect(button).toContain(
      "const label = pending ? 'Signing out…' : endSessionUrl ? 'Sign out of WitUS' : 'Sign out';",
    );
  });

  it("is handed the URL by the server, never built in the browser", () => {
    const code = stripComments(button);
    expect(code).not.toContain("https://");
    expect(code).not.toContain("witus.online");
    expect(read("src/app/dashboard/layout.tsx")).toContain(
      "<SignOutButton endSessionUrl={witusEndSessionEndpoint} />",
    );
  });
});
