import { type NextRequest, NextResponse } from "next/server";
import { listWaitlist, setWaitlistStatus } from "@/lib/access";
import { logAdminAction } from "@/lib/admin-data";
import { badRequest, notFound } from "@/lib/api";
import { getOwnerUser } from "@/lib/session";

// Owner-only. 404 (not 403) for non-owners so the admin surface isn't discoverable.
export async function GET() {
  if (!(await getOwnerUser())) return notFound();
  return NextResponse.json({ entries: await listWaitlist() });
}

export async function PATCH(request: NextRequest) {
  const owner = await getOwnerUser();
  if (!owner) return notFound();
  const body = await request.json();
  const email = String(body?.email ?? "").trim();
  const status = body?.status === "approved" ? "approved" : body?.status === "waiting" ? "waiting" : null;
  if (!email || !status) return badRequest("email and status (approved|waiting) are required");
  const row = await setWaitlistStatus(email, status);
  if (!row) return notFound();
  await logAdminAction(owner, `waitlist.${status === "approved" ? "approve" : "revoke"}`, {
    targetType: "waitlist",
    targetId: email,
  });
  return NextResponse.json({ entry: row });
}
