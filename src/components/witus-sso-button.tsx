'use client';

import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import {
  SILENT_SSO_TIMEOUT_MS,
  SSO_ATTEMPT_STORAGE_KEY,
  continueAsLabel,
  parseSilentSsoIdentity,
  silentSsoDecision,
  withAttemptMarker,
  type SsoIdentity,
} from '@/lib/silent-sso';

const CALLBACK_PATH = '/dashboard/media';

/**
 * "Sign in with WitUS" — starts the ecosystem OIDC flow against accounts.witus.online — plus the
 * silent "Continue as <name>" check layered on top of it.
 *
 * THE GATE. `enabled` is `hasWitusSso`, resolved on the SERVER (src/lib/env.ts) and handed down by
 * /signin, which already renders this component only behind it. It is repeated here as a hard
 * precondition so a future caller who forgets the wrapper gets a dark button rather than a request
 * to the IdP from an app that could not complete the flow anyway. An unapproved WitUS account is
 * still blocked by the invite-only allow-list in auth.ts (`user.create.before`), so none of this
 * opens signups.
 *
 * WHAT THE VISITOR SEES. The magic-link form is already on screen; nothing here delays it. The
 * button reads "Sign in with WitUS" from first paint. If the probe finds a WitUS session it becomes
 * "Continue as <name>". If the probe fails, times out, is refused by CORS, or is blocked by the
 * browser's third-party-cookie rules, nothing changes and nothing is said — a failed silent check
 * must be invisible. See src/lib/silent-sso.ts for the whole design.
 */
export function WitusSsoButton({
  enabled,
  silentCheckUrl,
}: {
  /** Server-resolved gate (`hasWitusSso`). False means this component does nothing at all. */
  enabled: boolean;
  /** IdP session endpoint, or null when ecosystem SSO is not configured. */
  silentCheckUrl: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [identity, setIdentity] = useState<SsoIdentity | null>(null);

  useEffect(() => {
    const endpoint = silentCheckUrl;
    const decision = silentSsoDecision({
      enabled,
      endpoint,
      search: window.location.search,
      attempted: readAttempted(),
    });
    // `!endpoint` is already implied by decision.attempt; repeated so the narrowing is the
    // compiler's rather than a cast that could outlive the invariant.
    if (!decision.attempt || !endpoint) return;

    // Abort rather than hang. A probe still in flight when the visitor has moved on wastes their
    // attention, not just a socket.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SILENT_SSO_TIMEOUT_MS);
    let live = true;

    // `credentials: "include"` is the entire mechanism: the answer depends on the IdP's OWN cookie,
    // which is third-party from here. Browsers that partition or block third-party cookies (Safari
    // ITP, Firefox Total Cookie Protection) answer nothing, and that is a supported outcome — the
    // visitor simply keeps the ordinary button.
    fetch(endpoint, {
      credentials: 'include',
      mode: 'cors',
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!live) return;
        const found = parseSilentSsoIdentity(payload);
        // NEVER a credential. This name is display copy for a button whose click runs the real
        // OIDC code flow; on its own it grants nothing and must never be treated as identity.
        if (found) setIdentity(found);
      })
      .catch(() => {
        // Invisible on purpose: network error, CORS refusal, abort, non-JSON body — all the same.
      })
      .finally(() => clearTimeout(timer));

    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, silentCheckUrl]);

  const start = useCallback(() => {
    setPending(true);
    // THE LOOP GUARD, written BEFORE the redirect and never after the return. Without it a visitor
    // whose IdP session has gone stale gets: probe says "Continue as X" → click → the IdP cannot
    // finish → back to /signin → probe says "Continue as X" → forever. With it, one attempt per
    // tab; the second render offers the plain button and the email form, which always work.
    writeAttempted();
    void authClient.signIn
      .oauth2({
        providerId: 'witus',
        callbackURL: CALLBACK_PATH,
        // Belt and braces with the callback interception in src/app/api/auth/[...all]/route.ts.
        // Better Auth only reads errorCallbackURL for failures AFTER it parses the OAuth state, so
        // an error the IdP itself returns is handled there; this covers the rest (token exchange,
        // issuer mismatch) and carries the same one-shot marker.
        errorCallbackURL: withAttemptMarker('/signin'),
      })
      .finally(() => setPending(false));
  }, []);

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={start}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-500 disabled:opacity-50"
      >
        {pending ? 'Redirecting…' : continueAsLabel(identity)}
      </button>
      {/* Always in the DOM so the label change is announced when it happens, and silent (and
          invisible) when the probe found nothing. */}
      <p
        role="status"
        aria-live="polite"
        className={identity ? 'mt-2 text-center text-xs text-neutral-500' : 'sr-only'}
      >
        {identity ? 'Not you? Use the email form above.' : ''}
      </p>
    </>
  );
}

/**
 * sessionStorage throws outright in some privacy modes, so both halves are wrapped. A browser that
 * cannot remember the attempt still gets the other half of the guard: the `?sso=tried` marker the
 * callback interception puts on the URL.
 */
function readAttempted(): boolean {
  try {
    return window.sessionStorage.getItem(SSO_ATTEMPT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeAttempted(): void {
  try {
    window.sessionStorage.setItem(SSO_ATTEMPT_STORAGE_KEY, '1');
  } catch {
    // No storage, no marker. The query-param half still applies.
  }
}
