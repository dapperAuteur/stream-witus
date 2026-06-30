import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { badRequest, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const episode = await sdb.getEpisode(id);
  if (!episode) return notFound();
  return NextResponse.json({ episode });
}

const FIELD_MAP: Record<string, string> = {
  title: "title",
  episode_number: "episodeNumber",
  season_number: "seasonNumber",
  air_date: "airDate",
  description: "description",
  show_notes: "showNotes",
  show_notes_format: "showNotesFormat",
  audio_url: "audioUrl",
  external_url: "externalUrl",
  duration_min: "durationMin",
  status: "status",
  visibility: "visibility",
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  for (const [bodyKey, field] of Object.entries(FIELD_MAP)) {
    if (body[bodyKey] !== undefined) updates[field] = body[bodyKey];
  }
  if (typeof updates.title === "string") updates.title = updates.title.trim();
  if (Object.keys(updates).length === 0) return badRequest("No valid fields to update");

  const episode = await sdb.updateEpisode(id, updates);
  if (!episode) return notFound();
  return NextResponse.json({ episode });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const ok = await sdb.softDeleteEpisode(id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
