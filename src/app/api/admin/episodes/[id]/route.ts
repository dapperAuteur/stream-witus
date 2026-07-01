import { type NextRequest, NextResponse } from "next/server";
import { updateAdminEpisode } from "@/db/episodes-admin";
import { isOwnerEmail } from "@/lib/access";
import { badRequest, notFound } from "@/lib/api";
import { getSessionUser } from "@/lib/session";

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
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user || !isOwnerEmail(user.email)) return notFound();
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  for (const [k, field] of Object.entries(FIELD_MAP)) {
    if (body[k] !== undefined) updates[field] = body[k];
  }
  if (typeof updates.title === "string") updates.title = updates.title.trim();
  if (Object.keys(updates).length === 0) return badRequest("No valid fields to update");

  const episode = await updateAdminEpisode(user.id, id, updates);
  if (!episode) return notFound();
  return NextResponse.json({ episode });
}
