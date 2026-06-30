import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const notes = await sdb.listNotes(id);
  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const body = await request.json();

  const note = await sdb.createNote(id, {
    title: body.title ?? null,
    content: body.content ?? "",
    contentFormat: body.content_format ?? "markdown",
    noteType: body.note_type ?? "general",
    audioUrl: body.audio_url ?? null,
    audioPublicId: body.audio_public_id ?? null,
    isPublic: body.is_public ?? false,
    sortOrder: body.sort_order ?? 0,
  });
  // null → the parent media item isn't owned by this user (or doesn't exist).
  if (!note) return notFound();
  return NextResponse.json({ note }, { status: 201 });
}
