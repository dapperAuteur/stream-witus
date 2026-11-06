import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PostHogProvider } from "@/lib/analytics/posthog-provider";
import { witusEndSessionEndpoint } from "@/lib/env";
import { getShellSession } from "@/lib/shell-session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stream.WitUS",
  description:
    "A personal-first cross-media tracker and companion for the All The Spoilers podcast — books, movies, TV — plus the ReadWitUS book club.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Never throws (falls back to signed out), so the shell renders even when auth or the DB is down.
  const shell = await getShellSession();

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="sr-only rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Skip to content
        </a>
        {/* The shell is here, in the root layout, so the 404 and the error boundary keep it too
            (witus docs/shared-ui-ux-dx.md, "Error pages keep the app shell"). */}
        <SiteHeader
          signedIn={shell.signedIn}
          email={shell.email}
          isAdmin={shell.isAdmin}
          endSessionUrl={shell.signedIn ? witusEndSessionEndpoint : null}
        />
        {/* Pages render their own <main>; this wrapper is the skip link's target. */}
        <div id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </div>
        <SiteFooter signedIn={shell.signedIn} />
        {/* Product analytics. Read the key HERE, in the Server Component, and pass it
            down — the client component must not touch process.env. `?? null` is what
            puts the provider in its supported keyless state (renders, captures
            nothing) rather than initialising PostHog with `undefined`.

            apiHost is our own path; next.config.ts rewrites /ingest to PostHog so ad
            blockers have no vendor hostname to match on. What a person reads and
            watches is sensitive, so autocapture and session recording stay OFF in the
            provider — see src/lib/analytics/posthog-provider.tsx. */}
        <PostHogProvider
          apiKey={process.env.NEXT_PUBLIC_POSTHOG_KEY ?? null}
          apiHost="/ingest"
        />
        {/* Vercel Analytics: traffic and Web Vitals, separate from PostHog's product
            events. Inert off Vercel, so it costs nothing in local dev. */}
        <Analytics />
      </body>
    </html>
  );
}
