import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

// Client-runtime error monitoring. Reads the PUBLIC DSN (inlined at build). Guarded: with no
// NEXT_PUBLIC_SENTRY_DSN the SDK is inert, so nothing is sent, no network call is made, and nothing
// changes for a visitor.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // Errors only: no tracing, no session replay (privacy + cost) until BAM opts in. Session replay
    // would also duplicate PostHog, which the ecosystem has already chosen for that job.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}

// Instruments App Router client navigations (no-op when not initialized).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
