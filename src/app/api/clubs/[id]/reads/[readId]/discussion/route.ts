import { type NextRequest, NextResponse } from "next/server";
import { getClubScoped } from "@/db/clubs";
import { badRequest, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string; readId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const { id, readId } = await params;
  // Posts are returned with the progress gate applied: locked posts carry no body.
  const posts = await cdb.listDiscussion(id, readId);
  if (posts === null) return notFound();
  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest, { params }: Params) {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const { id, readId } = await params;
  const body = await request.json();
  if (!body?.body?.trim()) return badRequest("body is required");
  const post = await cdb.createPost(id, readId, {
    milestoneId: body.milestone_id ?? null,
    isSpoiler: body.is_spoiler ?? false,
    body: body.body,
    parentId: body.parent_id ?? null,
  });
  if (!post) return notFound();
  return NextResponse.json({ post }, { status: 201 });
}
