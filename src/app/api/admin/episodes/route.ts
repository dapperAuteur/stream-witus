import { type NextRequest, NextResponse } from "next/server";
import { createAdminEpisode, listAllEpisodes, listShows } from "@/db/episodes-admin";
import { getOwnerUserId } from "@/lib/access";
import { logAdminAction } from "@/lib/admin-data";
import { badRequest, notFound } from "@/lib/api";
import { canModerate, canView, requireAdmin } from "@/lib/session";

export async function GET() {
  if (!(await requireAdmin(canView))) return notFound();
  const oid = (await getOwnerUserId()) ?? "";
  const [episodes, shows] = await Promise.all([listAllEpisodes(oid), listShows()]);
  return NextResponse.json({ episodes, shows });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(canModerate);
  if (!admin) return notFound();
  const oid = (await getOwnerUserId()) ?? "";
  const body = await request.json();
  if (!body?.show_id) return badRequest("show_id is required");
  if (!body?.title?.trim()) return badRequest("title is required");
  const episode = await createAdminEpisode(oid, {
    showId: body.show_id,
    title: body.title.trim(),
    episodeNumber: body.episode_number ?? null,
    showNotes: body.show_notes ?? null,
    showNotesExcerpt: body.show_notes_excerpt ?? null,
    artworkUrl: body.artwork_url ?? null,
    externalUrl: body.external_url ?? null,
    visibility: body.visibility === "public" ? "public" : "private",
  });
  await logAdminAction(admin, "episode.create", { targetType: "episode", targetId: episode.id });
  return NextResponse.json({ episode }, { status: 201 });
}
