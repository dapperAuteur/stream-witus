import { type NextRequest, NextResponse } from "next/server";
import { updateAdminEpisode } from "@/db/episodes-admin";
import { getOwnerUserId } from "@/lib/access";
import { logAdminAction } from "@/lib/admin-data";
import { badRequest, notFound } from "@/lib/api";
import { canModerate, requireAdmin } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

const FIELD_MAP: Record<string, string> = {
  show_id: "showId",
  title: "title",
  episode_number: "episodeNumber",
  show_notes: "showNotes",
  show_notes_excerpt: "showNotesExcerpt",
  artwork_url: "artworkUrl",
  external_url: "externalUrl",
  visibility: "visibility",
  // status here is for unpublish (published→recorded/draft); PUBLISHING goes
  // through the publish route so it fires the outbox draft.
  status: "status",
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const admin = await requireAdmin(canModerate);
  if (!admin) return notFound();
  const oid = (await getOwnerUserId()) ?? "";
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  for (const [k, field] of Object.entries(FIELD_MAP)) {
    if (body[k] !== undefined) updates[field] = body[k];
  }
  if (typeof updates.title === "string") updates.title = updates.title.trim();
  if (Object.keys(updates).length === 0) return badRequest("No valid fields to update");

  const episode = await updateAdminEpisode(oid, id, updates);
  if (!episode) return notFound();
  await logAdminAction(admin, "episode.edit", { targetType: "episode", targetId: id });
  return NextResponse.json({ episode });
}
