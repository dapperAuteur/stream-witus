import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

// Server-runtime error monitoring. Loaded from src/instrumentation.ts's register() on the Node
// runtime. The vendor is Better Stack, which ingests the standard Sentry SDK payloads, so the DSN
// is the only thing that decides where events land (swapping vendors is one env var, no code).
//
// GUARDED ON THE DSN: with no SENTRY_DSN set, init is skipped entirely and the SDK is inert, so the
// app ships and runs exactly as before until BAM provisions the project and sets the var
// (plans/user-tasks/19-betterstack-error-monitoring-dsn.md).
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Errors only for now: no performance/tracing spend until BAM opts in.
    tracesSampleRate: 0,
    // Never auto-attach IP / cookies / user email; the beforeSend scrub is the second line of defense.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
