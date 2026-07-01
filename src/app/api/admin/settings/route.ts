import { type NextRequest, NextResponse } from "next/server";
import { setSignupsOpen, signupsOpen } from "@/lib/access";
import { badRequest, notFound } from "@/lib/api";
import { isOwnerSession } from "@/lib/session";

export async function GET() {
  if (!(await isOwnerSession())) return notFound();
  return NextResponse.json({ signupsOpen: await signupsOpen() });
}

export async function PUT(request: NextRequest) {
  if (!(await isOwnerSession())) return notFound();
  const body = await request.json().catch(() => null);
  if (typeof body?.signupsOpen !== "boolean") return badRequest("signupsOpen (boolean) is required");
  await setSignupsOpen(body.signupsOpen);
  return NextResponse.json({ signupsOpen: body.signupsOpen });
}
