'use client';

import { useId, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth-client';
import {
  SIGN_OUT_EVERYWHERE_HELP,
  SIGN_OUT_EVERYWHERE_LABEL,
  SIGN_OUT_LABEL,
  SIGN_OUT_PENDING_LABEL,
  signOutEverywhere,
  signOutHere,
} from '@/lib/sign-out';

/**
 * "Sign out": ends ONLY the Stream.WitUS session, then /signin (BAM, 2026-10-29, witus task 128
 * option (b)). It never navigates to the IdP, so the WitUS session and other WitUS apps stay
 * signed in. Its label is always "Sign out" (shared UI rule: the header sign-in/out control is
 * never renamed). Ending the WitUS session is `SignOutEverywhereButton`'s job.
 */
export default function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOutHere({ signOut: () => signOut(), goLocal: (path) => router.push(path) });
        })
      }
      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition disabled:opacity-50"
    >
      <LogOut className="w-4 h-4" aria-hidden="true" /> {pending ? SIGN_OUT_PENDING_LABEL : SIGN_OUT_LABEL}
    </button>
  );
}

/**
 * "Sign out of WitUS everywhere": ends the Stream.WitUS session, THEN ends the WitUS session at
 * the IdP (order in `signOutEverywhere`, src/lib/sign-out.ts). Other WitUS apps stay signed in
 * until you sign out of them; the help text says so.
 *
 * `endSessionUrl` is resolved on the SERVER (`witusEndSessionEndpoint` in src/lib/env.ts, which
 * already carries the required `client_id`) and passed in by the dashboard layout. It is null when
 * WITUS_OIDC_CLIENT_ID is unset, and then nothing renders.
 */
export function SignOutEverywhereButton({ endSessionUrl }: { endSessionUrl: string | null }) {
  const helpId = useId();
  const [pending, startTransition] = useTransition();
  if (!endSessionUrl) return null;

  return (
    <div className="flex max-w-xs flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={pending}
        aria-describedby={helpId}
        onClick={() =>
          startTransition(async () => {
            await signOutEverywhere({
              signOut: () => signOut(),
              navigate: (url) => window.location.assign(url),
              endSessionUrl,
              origin: window.location.origin,
            });
          })
        }
        className="text-xs text-gray-500 underline underline-offset-4 hover:text-gray-800 transition disabled:opacity-50"
      >
        {pending ? SIGN_OUT_PENDING_LABEL : SIGN_OUT_EVERYWHERE_LABEL}
      </button>
      <p id={helpId} className="text-right text-xs text-gray-500">
        {SIGN_OUT_EVERYWHERE_HELP}
      </p>
    </div>
  );
}
