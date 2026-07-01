import { type NextRequest, NextResponse } from "next/server";
import { listWaitlist, setWaitlistStatus } from "@/lib/access";
import { badRequest, notFound } from "@/lib/api";
import { isOwnerSession } from "@/lib/session";

// Owner-only. 404 (not 403) for non-owners so the admin surface isn't discoverable.
export async function GET() {
  if (!(await isOwnerSession())) return notFound();
  return NextResponse.json({ entries: await listWaitlist() });
}

export async function PATCH(request: NextRequest) {
  if (!(await isOwnerSession())) return notFound();
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const status = body?.status === "approved" ? "approved" : body?.status === "waiting" ? "waiting" : null;
  if (!email || !status) return badRequest("email and status (approved|waiting) are required");
  const row = await setWaitlistStatus(email, status);
  if (!row) return notFound();
  return NextResponse.json({ entry: row });
}
