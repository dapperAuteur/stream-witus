import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { badRequest, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string; noteId: string }> };

const ALLOWED = {
  title: "title",
  content: "content",
  content_format: "contentFormat",
  note_type: "noteType",
  audio_url: "audioUrl",
  audio_public_id: "audioPublicId",
  is_public: "isPublic",
  sort_order: "sortOrder",
} as const;

export async function PATCH(request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id, noteId } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  for (const [bodyKey, field] of Object.entries(ALLOWED)) {
    if (body[bodyKey] !== undefined) updates[field] = body[bodyKey];
  }
  if (Object.keys(updates).length === 0) return badRequest("No valid fields to update");

  const note = await sdb.updateNote(id, noteId, updates);
  if (!note) return notFound();
  return NextResponse.json({ note });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id, noteId } = await params;
  const ok = await sdb.deleteNote(id, noteId);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
