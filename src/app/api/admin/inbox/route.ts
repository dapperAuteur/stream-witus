import { type NextRequest, NextResponse } from "next/server";
import { listInboxSubmissions, setInboxStatus } from "@/lib/admin-data";
import { isOwnerEmail } from "@/lib/access";
import { badRequest, notFound } from "@/lib/api";
import { getSessionUser } from "@/lib/session";

async function requireOwner() {
  const user = await getSessionUser();
  return user && isOwnerEmail(user.email);
}

export async function GET() {
  if (!(await requireOwner())) return notFound();
  return NextResponse.json({ submissions: await listInboxSubmissions() });
}

export async function PATCH(request: NextRequest) {
  if (!(await requireOwner())) return notFound();
  const body = await request.json();
  const status = ["new", "read", "archived"].includes(body?.status) ? body.status : null;
  if (!body?.id || !status) return badRequest("id and status (new|read|archived) required");
  const row = await setInboxStatus(body.id, status);
  if (!row) return notFound();
  return NextResponse.json({ submission: row });
}
