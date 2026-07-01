import { type NextRequest, NextResponse } from "next/server";
import { setSignupsOpen, signupsOpen } from "@/lib/access";
import { logAdminAction } from "@/lib/admin-data";
import { badRequest, notFound } from "@/lib/api";
import { getOwnerUser } from "@/lib/session";

export async function GET() {
  if (!(await getOwnerUser())) return notFound();
  return NextResponse.json({ signupsOpen: await signupsOpen() });
}

export async function PUT(request: NextRequest) {
  const owner = await getOwnerUser();
  if (!owner) return notFound();
  const body = await request.json().catch(() => null);
  if (typeof body?.signupsOpen !== "boolean") return badRequest("signupsOpen (boolean) is required");
  await setSignupsOpen(body.signupsOpen);
  await logAdminAction(owner, "signups.toggle", { meta: { signupsOpen: body.signupsOpen } });
  return NextResponse.json({ signupsOpen: body.signupsOpen });
}
