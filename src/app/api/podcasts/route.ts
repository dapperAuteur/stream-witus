import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { badRequest, unauthorized } from "@/lib/api";

export async function GET() {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const episodes = await sdb.listEpisodes();
  return NextResponse.json({ episodes });
}

export async function POST(request: NextRequest) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const body = await request.json();
  if (!body?.title?.trim()) return badRequest("title is required");

  const episode = await sdb.createEpisode({
    title: body.title.trim(),
    episodeNumber: body.episode_number ?? null,
    seasonNumber: body.season_number ?? null,
    airDate: body.air_date || null,
    description: body.description ?? null,
    showNotes: body.show_notes ?? null,
    audioUrl: body.audio_url ?? null,
    externalUrl: body.external_url ?? null,
    durationMin: body.duration_min ?? null,
    status: body.status ?? "draft",
    visibility: body.visibility ?? "private",
  });
  return NextResponse.json({ episode }, { status: 201 });
}
