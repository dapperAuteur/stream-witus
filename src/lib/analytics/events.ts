/**
 * Event taxonomy for Stream.WitUS.
 *
 * The ecosystem shares ONE PostHog project, separated by the `app` property that
 * posthog-provider registers on load. Two rules keep that project readable, and both
 * are cheap now and expensive to retrofit once data has landed:
 *
 *   1. `snake_case`, object first, verb in past tense — `route_viewed`.
 *   2. NEVER put the app name in the event name. `stream_signin_started` is wrong: it
 *      makes the same action from two apps look like two events and kills the cross-app
 *      comparison that sharing a project exists to enable. The `app` property already
 *      carries that.
 *
 * Shared lifecycle events (the SHARED_EVENTS block) use identical names in every
 * ecosystem app, so "where do people fall out of sign-in" is answerable across all of
 * them at once. Do not rename these here without renaming them everywhere.
 *
 * A NOTE SPECIFIC TO THIS APP. Stream.WitUS is a reading and viewing tracker, and what
 * a person reads or watches is sensitive on its own — ReadWitUS club membership and a
 * private shelf both qualify. That is why the provider's posture is not negotiable
 * here in particular: `autocapture: false` and `disable_session_recording: true` keep
 * shelf contents, club discussion, and search text off a third-party vendor's disks.
 * Any event added below carries slugs and ids, NEVER a title string, a note body, or
 * anything else a person typed.
 *
 * See the witus repo: lib/analytics/INTEGRATE.md and plans/26-posthog-ecosystem-rollout.md.
 */

/**
 * The `app` value stamped on every event from this repo.
 *
 * RECONCILE BEFORE READING CROSS-APP FUNNELS: the witus repo's identity registry
 * (lib/identity/clients.ts) lists this app as `"stream"`, not `"stream-witus"`. The
 * rollout brief specified this value explicitly, so it is what ships, but the two
 * should be made to agree — INTEGRATE.md's rule is that the analytics slug matches the
 * identity slug. Whichever way it is settled, change it in ONE place and change it
 * early: once events have landed under both spellings, the shared project shows this
 * app as two apps and no back-fill cleanly merges them.
 */
export const ANALYTICS_APP = "stream";

/**
 * Events with identical names across every ecosystem app. Names are contractual.
 */
export const SHARED_EVENTS = {
  signinStarted: "signin_started",
  signinSucceeded: "signin_succeeded",
  signinFailed: "signin_failed",
} as const;

/**
 * Events specific to Stream.WitUS.
 *
 * Deliberately minimal right now: this change is the wiring, not the instrumentation.
 * Names are added here as call sites are actually added, so the shared project never
 * carries a declared event that nothing emits — an unfired name is indistinguishable
 * from a broken one when you are reading a funnel.
 */
export const EVENTS = {
  /** An explicit route view. capture_pageview is off — Next's client router would
   *  fire it once and then lie — so route changes are reported deliberately. */
  routeViewed: "route_viewed",
  ...SHARED_EVENTS,
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
