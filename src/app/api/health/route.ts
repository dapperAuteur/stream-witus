import { NextResponse } from "next/server";
import { pingDatabase } from "@/db/health";

// Public, unauthenticated uptime probe. Uptime monitors must point HERE, not at `/`:
// the homepage can answer 200 from cache (or from a static render) while Neon is
// down, which makes a green check meaningless. This route runs the query.
//
// Never cached, on any layer, or the probe reports the last good result forever.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/** Past this, a hung database is treated as down. Kept under the monitor's own timeout. */
const TIMEOUT_MS = 4_000;

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

/**
 * Deliberately checks ONLY the database. It never calls a streaming provider, a
 * player embed host, or any other third-party API: a vendor outage must not turn
 * this app's uptime monitor red, and provider errors routinely carry stream keys
 * and signed playback URLs. It also reports nothing about stream state, which
 * provider is configured, or whether any key is valid.
 */
async function checkDependencies(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      pingDatabase(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("health check timed out")), TIMEOUT_MS);
      }),
    ]);
    return true;
  } catch {
    // No binding on purpose. The raw error is never read, never logged and never
    // returned: driver and timeout errors can embed the connection string, and the
    // response body is public. A constant string is all that goes to the logs.
    console.error("[health] dependency check failed");
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const ok = await checkDependencies();
  // Fixed literals both ways. The failure token names no dependency, no vendor and
  // no cause, so a probe response can never describe the app's internals.
  return ok
    ? NextResponse.json({ ok: true, service: "stream-witus" }, { status: 200, headers: NO_STORE })
    : NextResponse.json(
        { ok: false, error: "dependency_unavailable" },
        { status: 503, headers: NO_STORE },
      );
}

export async function HEAD() {
  const ok = await checkDependencies();
  return new Response(null, { status: ok ? 200 : 503, headers: NO_STORE });
}
