import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found · Stream.WitUS",
};

/**
 * 404 for the whole app, rendered inside the root layout so the site header (with "Sign in") and
 * footer stay on screen (witus docs/shared-ui-ux-dx.md, "Error pages keep the app shell"). Also
 * what owner-scoped pages show when a record belongs to someone else: a 404, never a redirect.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-sm font-medium text-fuchsia-300">404</p>
      <h1 className="text-2xl font-bold text-white">Page not found</h1>
      <p className="text-sm text-neutral-400">
        This page does not exist, or it is not shared with you. Check the address, or pick up from
        one of these.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg bg-fuchsia-600 px-4 text-sm font-medium text-white transition hover:bg-fuchsia-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
        >
          Go to the home page
        </Link>
        <Link
          href="/episodes"
          className="inline-flex min-h-11 items-center rounded-lg border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-fuchsia-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
        >
          Episodes
        </Link>
      </div>
    </main>
  );
}
