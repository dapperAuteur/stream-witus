import Link from "next/link";
import { CONTACT_HREF } from "@/lib/site-nav";

/**
 * The 403 page body: signed in, but this account lacks the role the page needs. Rendered by the
 * page itself inside the normal shell (witus docs/shared-ui-ux-dx.md, "Every 4xx and 5xx is
 * handled gracefully": a 403 "names who to ask"). The HTTP status stays 200 because Next's
 * `forbidden()` still needs the experimental `authInterrupts` flag.
 *
 * Styled for the dashboard's light surface, where every caller lives.
 */
export function AccessDenied({ what = "this page" }: { what?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <p className="text-sm font-medium text-fuchsia-700">403</p>
      <h1 className="text-2xl font-bold text-gray-900">You don&apos;t have access to {what}</h1>
      <p className="text-sm text-gray-600">
        Your account is signed in but does not have the admin role this needs. Ask the Stream.WitUS
        owner to grant it.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href={CONTACT_HREF}
          className="inline-flex min-h-11 items-center rounded-lg bg-fuchsia-700 px-4 text-sm font-medium text-white transition hover:bg-fuchsia-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-600"
        >
          Email the owner
        </a>
        <Link
          href="/dashboard/media"
          className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 px-4 text-sm text-gray-800 transition hover:border-fuchsia-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-600"
        >
          Back to my media
        </Link>
      </div>
    </div>
  );
}
