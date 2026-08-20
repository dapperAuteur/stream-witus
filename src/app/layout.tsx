import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { PostHogProvider } from "@/lib/analytics/posthog-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stream.WitUS",
  description:
    "A personal-first cross-media tracker and companion for the All The Spoilers podcast — books, movies, TV — plus the ReadWitUS book club.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
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
