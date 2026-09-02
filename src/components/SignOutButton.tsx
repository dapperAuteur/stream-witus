'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth-client';

/**
 * Sign out — locally always, and from the whole ecosystem when this app is a configured WitUS OIDC
 * client (BAM's decision, 2026-08-30: "signout signs out of every app").
 *
 * `endSessionUrl` is resolved on the SERVER (`witusEndSessionEndpoint` in src/lib/env.ts, which
 * already carries the required `client_id`) and passed in by the dashboard layout. It is null when
 * WITUS_OIDC_CLIENT_ID is unset, and sign-out then behaves exactly as it did before.
 */
export default function SignOutButton({ endSessionUrl = null }: { endSessionUrl?: string | null } = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const label = pending ? 'Signing out…' : endSessionUrl ? 'Sign out of WitUS' : 'Sign out';

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // ORDER IS THE SAFETY PROPERTY. Destroy the LOCAL session first, then hand off. If the
          // IdP is unreachable or refuses the logout, the person is still signed out HERE. Handing
          // off first would turn any IdP failure into "I clicked sign out and I'm still signed in".
          await signOut();

          if (endSessionUrl) {
            // The trailing slash is REQUIRED. Better Auth exact-matches post_logout_redirect_uri
            // against this client's registered redirectUrls, and the IdP registry
            // (gemini/witus lib/identity/clients.ts) registers `origin + "/"` — for this app,
            // `https://stream.witus.online/`. Drop the slash and the IdP returns invalid_request.
            // On an unregistered host (a Vercel preview URL) the IdP refuses the return trip and
            // keeps the visitor on its own page; they are signed out of both places either way.
            const back = `${window.location.origin}/`;
            // A full navigation, not router.push: this leaves our origin for the IdP.
            // `&`, not `?`: endSessionUrl already carries client_id (see src/lib/env.ts).
            window.location.assign(
              `${endSessionUrl}&post_logout_redirect_uri=${encodeURIComponent(back)}`,
            );
            return;
          }

          router.push('/signin');
        })
      }
      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition disabled:opacity-50"
    >
      <LogOut className="w-4 h-4" aria-hidden="true" /> {label}
    </button>
  );
}
