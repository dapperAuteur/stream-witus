import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

// Next.js instrumentation hook. Loads the right error-monitoring config per runtime, and reports
// server-side App Router errors via onRequestError. Everything is inert without a SENTRY_DSN
// (see the guards in sentry.server.config.ts / sentry.edge.config.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("../sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("../sentry.edge.config");
}

// Captures errors thrown while rendering or serving a request (route handlers, RSC, generateMetadata).
// captureRequestError attaches the route + request context itself; the beforeSend scrub in
// src/lib/sentry-scrub.ts then strips the cookies, auth headers, emails and signed URLs off it.
export const onRequestError: Instrumentation.onRequestError = Sentry.captureRequestError;
