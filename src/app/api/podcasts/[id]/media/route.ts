import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { badRequest, notFound, unauthorized } from "@/lib/api";

// Link / unlink tracked media to an "All The Spoilers" episode. `[id]` is the
// episode id. Both the episode and the media item must be owned by the caller
// (enforced in ScopedDb) — no cross-owner linking.

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const links = await sdb.listEpisodeLinks(id);
  if (links === null) return notFound(); // episode not owned / missing
  return NextResponse.json({ links });
}

export async function POST(request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  if (!body?.media_item_id) return badRequest("media_item_id is required");

  const link = await sdb.linkMediaToEpisode(id, {
    mediaItemId: body.media_item_id,
    discussionNotes: body.discussion_notes ?? null,
    timestampStart: body.timestamp_start ?? null,
    sortOrder: body.sort_order ?? 0,
  });
  if (!link) return notFound();
  return NextResponse.json({ link }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  if (!body?.media_item_id) return badRequest("media_item_id is required");

  const updates: { timestampStart?: string | null; discussionNotes?: string | null } = {};
  if (body.timestamp_start !== undefined) updates.timestampStart = body.timestamp_start || null;
  if (body.discussion_notes !== undefined) updates.discussionNotes = body.discussion_notes || null;
  if (Object.keys(updates).length === 0) return badRequest("No valid fields to update");

  const link = await sdb.updateEpisodeLink(id, body.media_item_id, updates);
  if (!link) return notFound();
  return NextResponse.json({ link });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const mediaItemId = request.nextUrl.searchParams.get("media_item_id");
  if (!mediaItemId) return badRequest("media_item_id is required");
  const ok = await sdb.unlinkMediaFromEpisode(id, mediaItemId);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
