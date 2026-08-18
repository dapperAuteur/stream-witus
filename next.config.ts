import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // @neondatabase/serverless uses `ws` for websocket transport; its native
  // bindings get mangled by the build minifier unless externalized. Mirrors
  // the witus-learn / shop-witus fix for `TypeError: b.mask is not a function`.
  serverExternalPackages: ["@neondatabase/serverless", "ws"],

  // PostHog's endpoints use trailing slashes (/e/, /flags/, /s/). Without this, Next
  // issues a 308 to the slashless form before the rewrite below runs and ingest breaks.
  // Required by PostHog's documented Next.js proxy setup.
  //
  // SIDE EFFECT, and an open one: this disables Next's automatic trailing-slash redirect
  // for EVERY route, not just /ingest. /shelf/ no longer 308s to /shelf, so both forms
  // now return 200. This app sets no `alternates.canonical` and no `metadataBase` on any
  // page today, so nothing currently tells a crawler which form is the real URL. That is
  // small but real duplicate-URL exposure. The fix is per-page canonicals, NOT a single
  // canonical on the root layout — metadata is inherited, so a root canonical would make
  // every child page claim the homepage as its canonical and is strictly worse than
  // none. See the witus repo, lib/analytics/INTEGRATE.md step 2.
  skipTrailingSlashRedirect: true,

  async rewrites() {
    // Reverse-proxy PostHog through our own origin. us.i.posthog.com is on uBlock
    // Origin, Brave Shields, and Safari's tracker list, so a meaningful share of
    // events never leave the browser — including, reliably, our own test visits.
    // Routing ingest through stream.witus.online leaves blockers nothing to match on.
    //
    // Assets come from a different upstream host than ingest, hence two rules. The
    // more specific /static rule must come first.
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },

  images: {
    // Remote covers come from TMDB / Open Library / Cloudinary (docs/06 #4).
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

// Wrap with the Sentry build plugin (the SDK Better Stack ingests). Safe with no Sentry env set:
// without SENTRY_AUTH_TOKEN it simply skips source-map upload (you get minified stack traces), and
// the runtime SDK stays inert without a DSN. org/project/authToken come from env so nothing secret
// is committed here.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // The old top-level `disableLogger: true` is deprecated as of @sentry/nextjs 10.69 and prints a
  // build warning; this is the same thing (strip the SDK's debug logging from the bundle).
  webpack: { treeshake: { removeDebugLogging: true } },
});
