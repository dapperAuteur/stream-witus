import { type NextRequest, NextResponse } from "next/server";
import { badRequest, unauthorized } from "@/lib/api";
import { searchMetadata } from "@/lib/metadata";
import { getSessionUserId } from "@/lib/session";

// Phase 4: auto-metadata search. Auth-only (no DB write) — the picked result is
// passed to the add form as a prefill, and creating it dedups on external id.
export async function GET(request: NextRequest) {
  if (!(await getSessionUserId())) return unauthorized();

  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const type = sp.get("type") ?? undefined;
  if (!q) return badRequest("q is required");

  const results = await searchMetadata(q, type);
  return NextResponse.json({ results });
}
