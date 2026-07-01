import { type NextRequest, NextResponse } from "next/server";
import { listInboxSubmissions, logAdminAction, setInboxStatus } from "@/lib/admin-data";
import { badRequest, notFound } from "@/lib/api";
import { canModerate, canView, requireAdmin } from "@/lib/session";

export async function GET() {
  if (!(await requireAdmin(canView))) return notFound();
  return NextResponse.json({ submissions: await listInboxSubmissions() });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(canModerate);
  if (!admin) return notFound();
  const body = await request.json();
  const status = ["new", "read", "archived"].includes(body?.status) ? body.status : null;
  if (!body?.id || !status) return badRequest("id and status (new|read|archived) required");
  const row = await setInboxStatus(body.id, status);
  if (!row) return notFound();
  await logAdminAction(admin, "inbox.status", { targetType: "inbox", targetId: body.id, meta: { status } });
  return NextResponse.json({ submission: row });
}
