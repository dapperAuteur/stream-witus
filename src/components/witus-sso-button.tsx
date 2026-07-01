'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

/**
 * "Sign in with WitUS" — starts the ecosystem OIDC flow against accounts.witus.online.
 * Rendered only when the SSO client is provisioned (see `hasWitusSso`); the signin
 * page gates it. An unapproved WitUS account is still blocked by the invite-only
 * allow-list in auth.ts (user.create.before), so this doesn't open signups.
 */
export function WitusSsoButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void authClient.signIn
          .oauth2({ providerId: 'witus', callbackURL: '/dashboard/media' })
          .finally(() => setPending(false));
      }}
      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-500 disabled:opacity-50"
    >
      {pending ? 'Redirecting…' : 'Sign in with WitUS'}
    </button>
  );
}
