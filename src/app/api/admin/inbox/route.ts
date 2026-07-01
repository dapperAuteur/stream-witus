import { type NextRequest, NextResponse } from "next/server";
import { listInboxSubmissions, logAdminAction, setInboxStatus } from "@/lib/admin-data";
import { badRequest, notFound } from "@/lib/api";
import { getOwnerUser } from "@/lib/session";

export async function GET() {
  if (!(await getOwnerUser())) return notFound();
  return NextResponse.json({ submissions: await listInboxSubmissions() });
}

export async function PATCH(request: NextRequest) {
  const owner = await getOwnerUser();
  if (!owner) return notFound();
  const body = await request.json();
  const status = ["new", "read", "archived"].includes(body?.status) ? body.status : null;
  if (!body?.id || !status) return badRequest("id and status (new|read|archived) required");
  const row = await setInboxStatus(body.id, status);
  if (!row) return notFound();
  await logAdminAction(owner, "inbox.status", { targetType: "inbox", targetId: body.id, meta: { status } });
  return NextResponse.json({ submission: row });
}
