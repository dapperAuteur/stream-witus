import { type NextRequest, NextResponse } from "next/server";
import { getClubScoped } from "@/db/clubs";
import { badRequest, notFound, unauthorized } from "@/lib/api";
import { fireClubNewRead } from "@/lib/outbox-trigger";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const { id } = await params;
  const reads = await cdb.listReads(id);
  if (reads === null) return notFound();
  return NextResponse.json({ reads });
}

export async function POST(request: NextRequest, { params }: Params) {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  if (!body?.title?.trim() && !body?.media_item_id) return badRequest("title or media_item_id is required");
  const read = await cdb.createRead(id, {
    mediaItemId: body.media_item_id || null,
    title: body.title?.trim() || null,
    status: ["upcoming", "active", "completed"].includes(body.status) ? body.status : "upcoming",
    startDate: body.start_date || null,
    targetEndDate: body.target_end_date || null,
  });
  if (!read) return notFound(); // not a manager

  // Phase 7: a PUBLIC club starting an active read fires an outbox draft.
  if (read.status === "active" && read.title) {
    const club = await cdb.getClub(id);
    if (club?.visibility === "public") {
      fireClubNewRead(cdb.userId, { id: read.id, title: read.title, coverImageUrl: null }, { name: club.name });
    }
  }

  return NextResponse.json({ read }, { status: 201 });
}
