import { type NextRequest, NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/access";
import { importAllShows } from "@/db/episodes-admin";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily Disctopia re-import (Vercel Cron, see vercel.json). Imports new episodes
// for every show with a feed URL as DRAFTS — never auto-publishes, so no social
// drafts fire. Auth: when CRON_SECRET is set, require Vercel's bearer token; in
// local dev (no secret) it's open so it can be smoke-tested.
export async function GET(request: NextRequest) {
  if (env.CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const ownerId = await getOwnerUserId();
  if (!ownerId) return NextResponse.json({ error: "no owner user" }, { status: 500 });

  const results = await importAllShows(ownerId);
  const inserted = results.reduce((n, r) => n + (r.inserted ?? 0), 0);
  console.log("[cron:import-podcasts]", { shows: results.length, inserted });
  return NextResponse.json({ ok: true, inserted, results });
}
