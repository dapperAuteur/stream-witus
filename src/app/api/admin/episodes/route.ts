import { type NextRequest, NextResponse } from "next/server";
import { createAdminEpisode, listAllEpisodes, listShows } from "@/db/episodes-admin";
import { logAdminAction } from "@/lib/admin-data";
import { badRequest, notFound } from "@/lib/api";
import { getOwnerUser } from "@/lib/session";

export async function GET() {
  const user = await getOwnerUser();
  if (!user) return notFound();
  const [episodes, shows] = await Promise.all([listAllEpisodes(user.id), listShows()]);
  return NextResponse.json({ episodes, shows });
}

export async function POST(request: NextRequest) {
  const user = await getOwnerUser();
  if (!user) return notFound();
  const body = await request.json();
  if (!body?.show_id) return badRequest("show_id is required");
  if (!body?.title?.trim()) return badRequest("title is required");
  const episode = await createAdminEpisode(user.id, {
    showId: body.show_id,
    title: body.title.trim(),
    episodeNumber: body.episode_number ?? null,
    showNotes: body.show_notes ?? null,
    showNotesExcerpt: body.show_notes_excerpt ?? null,
    artworkUrl: body.artwork_url ?? null,
    externalUrl: body.external_url ?? null,
    visibility: body.visibility === "public" ? "public" : "private",
  });
  await logAdminAction(user, "episode.create", { targetType: "episode", targetId: episode.id });
  return NextResponse.json({ episode }, { status: 201 });
}
