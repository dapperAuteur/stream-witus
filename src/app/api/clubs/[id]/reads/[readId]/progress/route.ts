import { type NextRequest, NextResponse } from "next/server";
import { getClubScoped } from "@/db/clubs";
import { notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string; readId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const { id, readId } = await params;
  const progress = await cdb.getMyProgress(id, readId);
  // null read → 404; null progress (member hasn't set one) is still a valid 200.
  if (progress === null && !(await cdb.getRead(id, readId))) return notFound();
  return NextResponse.json({ progress });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const { id, readId } = await params;
  const body = await request.json();
  const milestoneId = body.milestone_id ?? null;
  const progress = await cdb.setMyProgress(id, readId, milestoneId);
  if (!progress) return notFound(); // bad read / milestone not in read
  return NextResponse.json({ progress });
}
