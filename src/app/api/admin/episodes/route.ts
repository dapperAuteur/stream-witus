import { type NextRequest, NextResponse } from "next/server";
import { createAdminEpisode, listAllEpisodes, listShows } from "@/db/episodes-admin";
import { isOwnerEmail } from "@/lib/access";
import { badRequest, notFound } from "@/lib/api";
import { getSessionUser } from "@/lib/session";

async function owner() {
  const user = await getSessionUser();
  return user && isOwnerEmail(user.email) ? user : null;
}

export async function GET() {
  const user = await owner();
  if (!user) return notFound();
  const [episodes, shows] = await Promise.all([listAllEpisodes(user.id), listShows()]);
  return NextResponse.json({ episodes, shows });
}

export async function POST(request: NextRequest) {
  const user = await owner();
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
  return NextResponse.json({ episode }, { status: 201 });
}
