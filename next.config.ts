import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // @neondatabase/serverless uses `ws` for websocket transport; its native
  // bindings get mangled by the build minifier unless externalized. Mirrors
  // the witus-learn / shop-witus fix for `TypeError: b.mask is not a function`.
  serverExternalPackages: ["@neondatabase/serverless", "ws"],
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
