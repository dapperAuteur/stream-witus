"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

/**
 * Route error boundary for every page under the root layout, so the site header and footer stay
 * on screen (witus docs/shared-ui-ux-dx.md, "Error pages keep the app shell"). One h1, a plain
 * message, Try again and a home link. Never the raw error message or a stack trace: those go to
 * Sentry (scrubbed, inert without a DSN). The digest is an opaque id that support can look up.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
      <p className="text-sm text-neutral-400">
        Stream.WitUS hit an unexpected error loading this page. Your shelf, notes and clubs are
        untouched. Try again, or head back home.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-lg bg-fuchsia-600 px-4 text-sm font-medium text-white transition hover:bg-fuchsia-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-fuchsia-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
        >
          Go to the home page
        </Link>
      </div>
      {error.digest ? <p className="text-xs text-neutral-400">Error ref: {error.digest}</p> : null}
    </main>
  );
}
