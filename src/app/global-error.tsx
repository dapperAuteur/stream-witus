"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Last-resort error boundary. Catches errors thrown by the root layout itself, where an
// `error.tsx` would never run because the layout is the thing that broke. It must render
// its own <html>/<body> because the crashed root layout is not there to supply them.
//
// Deliberately dependency-free: no imports from @/components or @/lib (any of which could
// be the thing that is broken) and no Tailwind classes, since globals.css may not have
// loaded. Inline styles only. The one intentional exception is the Sentry SDK, which is
// the entire reason we would ever find out this fired, and it is inert without a DSN.
//
// The crashed root layout took the site header with it, so this minimal shell carries the brand, a
// home link and the "Sign in" link itself (witus docs/shared-ui-ux-dx.md, "Error pages keep the app
// shell"). Plain <a> tags, not next/link: a full page load is the point after a root crash.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Reports the root-boundary crash. A no-op when no DSN is configured.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: 16,
          textAlign: "center",
        }}
      >
        <main>
          <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the point after a root crash */}
            <a href="/" style={{ color: "inherit", textDecoration: "none" }}>
              Stream.WitUS
            </a>
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ color: "#71717a", fontSize: 14 }}>
            Stream WitUS hit an unexpected error. Your shelf and follows are untouched.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 12,
              minHeight: 44,
              padding: "0 16px",
              border: "1px solid #ccc",
              borderRadius: 6,
              background: "transparent",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            Try again
          </button>
          <p style={{ marginTop: 16, display: "flex", gap: 16, justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the point after a root crash */}
            <a href="/" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", color: "#c026d3" }}>
              Go to the home page
            </a>
            <a href="/signin" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", color: "#c026d3" }}>
              Sign in
            </a>
          </p>
          {error.digest ? (
            <p style={{ marginTop: 16, fontSize: 12, color: "#9ca3af" }}>
              Error ref: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
