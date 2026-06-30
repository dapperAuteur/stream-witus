import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api";
import { getSessionUserId } from "@/lib/session";

// Brands were dropped for the single-podcast v1 (docs/06 #1). The ported media /
// episode forms still probe this endpoint; returning an empty array keeps them
// working (the brand selector simply never renders) without editing the UI.
export async function GET() {
  if (!(await getSessionUserId())) return unauthorized();
  return NextResponse.json([]);
}
