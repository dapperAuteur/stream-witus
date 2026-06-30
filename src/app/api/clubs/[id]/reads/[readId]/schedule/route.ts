import { type NextRequest, NextResponse } from "next/server";
import { getClubScoped } from "@/db/clubs";
import { badRequest, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string; readId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const { id, readId } = await params;
  const schedule = await cdb.listSchedule(id, readId);
  if (schedule === null) return notFound();
  return NextResponse.json({ schedule });
}

export async function POST(request: NextRequest, { params }: Params) {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const { id, readId } = await params;
  const body = await request.json();
  if (!body?.label?.trim()) return badRequest("label is required");
  const milestone = await cdb.createMilestone(id, readId, {
    label: body.label.trim(),
    dueDate: body.due_date || null,
    sortOrder: typeof body.sort_order === "number" ? body.sort_order : 0,
  });
  if (!milestone) return notFound();
  return NextResponse.json({ milestone }, { status: 201 });
}
