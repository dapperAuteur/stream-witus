import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { badRequest, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  // Confirm ownership of the anchor item before exposing its links.
  if (!(await sdb.getMediaItem(id))) return notFound();
  const relationships = await sdb.listRelationships(id);
  return NextResponse.json({ relationships });
}

export async function POST(request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const body = await request.json();

  const relatedId = body.related_id ?? body.child_id;
  if (!relatedId) return badRequest("related_id is required");
  if (!body.relationship_type) return badRequest("relationship_type is required");
  if (relatedId === id) return badRequest("Cannot link an item to itself");

  // direction is from the anchor item's view; both endpoints must be owned (ScopedDb).
  const direction: "parent" | "child" = body.direction === "parent" ? "parent" : "child";
  const relationship = await sdb.createRelationship({
    anchorId: id,
    relatedId,
    relationshipType: body.relationship_type,
    direction,
    sortOrder: body.sort_order ?? 0,
  });
  if (!relationship) return notFound();
  return NextResponse.json({ relationship }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const relationshipId = request.nextUrl.searchParams.get("relationship_id");
  if (!relationshipId) return badRequest("relationship_id is required");
  const ok = await sdb.deleteRelationship(relationshipId);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
