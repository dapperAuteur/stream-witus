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
      className="flex min-h-11 w-full items-center gap-1.5 rounded-md px-2 text-sm font-medium text-neutral-200 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400 disabled:opacity-50"
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
 * already carries the required `client_id`) and passed in by the root layout's site header. It is null when
 * WITUS_OIDC_CLIENT_ID is unset, and then nothing renders.
 */
export function SignOutEverywhereButton({ endSessionUrl }: { endSessionUrl: string | null }) {
  const helpId = useId();
  const [pending, startTransition] = useTransition();
  if (!endSessionUrl) return null;

  return (
    <div className="flex flex-col items-start gap-0.5 border-t border-neutral-800 pt-2">
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
        className="min-h-11 rounded-md px-2 text-left text-sm text-neutral-200 underline underline-offset-4 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400 disabled:opacity-50"
      >
        {pending ? SIGN_OUT_PENDING_LABEL : SIGN_OUT_EVERYWHERE_LABEL}
      </button>
      <p id={helpId} className="px-2 text-xs text-neutral-400">
        {SIGN_OUT_EVERYWHERE_HELP}
      </p>
    </div>
  );
}
