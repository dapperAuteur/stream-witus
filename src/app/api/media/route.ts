import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb, type MediaItemInput } from "@/db/scoped";
import { badRequest, toStringArray, unauthorized } from "@/lib/api";

export async function GET(request: NextRequest) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();

  const sp = request.nextUrl.searchParams;
  const { items, total } = await sdb.listMediaItems({
    mediaType: sp.get("media_type"),
    status: sp.get("status"),
    categoryId: sp.get("category_id"),
    search: sp.get("search"),
    isFavorite: sp.get("is_favorite") === "true",
    limit: Number(sp.get("limit")) || 50,
    offset: Number(sp.get("offset")) || 0,
  });
  return NextResponse.json({ items, total });
}

export async function POST(request: NextRequest) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();

  const body = await request.json();
  if (!body?.title?.trim()) return badRequest("title is required");
  if (!body?.media_type?.trim()) return badRequest("media_type is required");

  const input: MediaItemInput = {
    title: body.title.trim(),
    mediaType: body.media_type.trim(),
    creator: body.creator || null,
    categoryId: body.category_id || null,
    status: body.status || "want_to_consume",
    rating: body.rating ?? null,
    genre: toStringArray(body.genre),
    tags: toStringArray(body.tags),
    coverImageUrl: body.cover_image_url || null,
    externalUrl: body.external_url || null,
    startDate: body.start_date || null,
    endDate: body.end_date || null,
    yearReleased: body.year_released ?? null,
    sourcePlatform: body.source_platform || null,
    seasonNumber: body.season_number ?? null,
    episodeNumber: body.episode_number ?? null,
    totalSeasons: body.total_seasons ?? null,
    totalEpisodes: body.total_episodes ?? null,
    currentProgress: body.current_progress || null,
    totalLength: body.total_length || null,
    visibility: body.visibility || "private",
    isFavorite: body.is_favorite ?? false,
    shareOnFinish: body.share_on_finish ?? false,
    notes: body.notes || null,
    externalSource: body.external_source ?? null,
    externalId: body.external_id ?? null,
  };

  const item = await sdb.createMediaItem(input);
  return NextResponse.json({ item }, { status: 201 });
}
