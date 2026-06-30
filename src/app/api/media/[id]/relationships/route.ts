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

  const childId = body.child_id ?? body.related_id;
  if (!childId) return badRequest("child_id is required");
  if (!body.relationship_type) return badRequest("relationship_type is required");

  // The route's [id] is the parent; child must also be owned (enforced in ScopedDb).
  const relationship = await sdb.createRelationship({
    parentId: id,
    childId,
    relationshipType: body.relationship_type,
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
