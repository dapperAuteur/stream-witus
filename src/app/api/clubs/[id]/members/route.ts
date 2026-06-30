import { type NextRequest, NextResponse } from "next/server";
import { getClubScoped } from "@/db/clubs";
import { badRequest, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const { id } = await params;
  const members = await cdb.listMembers(id);
  if (members === null) return notFound();
  return NextResponse.json({ members });
}

export async function POST(request: NextRequest, { params }: Params) {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  if (!body?.email?.trim()) return badRequest("email is required");
  const role = body.role === "moderator" ? "moderator" : "member";
  const result = await cdb.addMemberByEmail(id, body.email, role);
  if (result === null) return notFound(); // not allowed / not a manager
  if ("error" in result) return badRequest("No Stream.WitUS user with that email — they must sign in once first");
  return NextResponse.json({ member: result.member }, { status: 201 });
}
