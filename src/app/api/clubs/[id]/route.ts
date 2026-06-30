import { type NextRequest, NextResponse } from "next/server";
import { getClubScoped } from "@/db/clubs";
import { badRequest, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const { id } = await params;
  const club = await cdb.getClub(id);
  if (!club) return notFound();
  return NextResponse.json({ club, role: await cdb.myRole(id) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.description !== undefined) updates.description = body.description || null;
  if (body.visibility !== undefined) updates.visibility = body.visibility === "public" ? "public" : "private";
  if (Object.keys(updates).length === 0) return badRequest("No valid fields to update");
  const club = await cdb.updateClub(id, updates);
  if (!club) return notFound();
  return NextResponse.json({ club });
}
