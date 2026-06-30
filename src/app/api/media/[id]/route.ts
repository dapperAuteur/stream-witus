import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb, type MediaItemInput } from "@/db/scoped";
import { badRequest, notFound, toStringArray, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const item = await sdb.getMediaItem(id);
  if (!item) return notFound();
  return NextResponse.json({ item });
}

// Fields a client may set, mapped snake_case → the ScopedDb input shape.
const FIELD_MAP: Record<string, keyof MediaItemInput> = {
  title: "title",
  media_type: "mediaType",
  creator: "creator",
  category_id: "categoryId",
  status: "status",
  rating: "rating",
  cover_image_url: "coverImageUrl",
  external_url: "externalUrl",
  start_date: "startDate",
  end_date: "endDate",
  year_released: "yearReleased",
  source_platform: "sourcePlatform",
  season_number: "seasonNumber",
  episode_number: "episodeNumber",
  total_seasons: "totalSeasons",
  total_episodes: "totalEpisodes",
  current_progress: "currentProgress",
  total_length: "totalLength",
  visibility: "visibility",
  is_favorite: "isFavorite",
  notes: "notes",
  external_source: "externalSource",
  external_id: "externalId",
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  for (const [bodyKey, field] of Object.entries(FIELD_MAP)) {
    if (body[bodyKey] !== undefined) updates[field] = body[bodyKey];
  }
  if (body.genre !== undefined) updates.genre = toStringArray(body.genre);
  if (body.tags !== undefined) updates.tags = toStringArray(body.tags);
  if (typeof updates.title === "string") updates.title = updates.title.trim();

  if (Object.keys(updates).length === 0) return badRequest("No valid fields to update");

  const item = await sdb.updateMediaItem(id, updates as Partial<MediaItemInput>);
  if (!item) return notFound();
  return NextResponse.json({ item });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const ok = await sdb.softDeleteMediaItem(id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
