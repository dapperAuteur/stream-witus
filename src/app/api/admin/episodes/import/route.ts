import { type NextRequest, NextResponse } from "next/server";
import { buildImportPreview, getShowById, importEpisodes } from "@/db/episodes-admin";
import { getOwnerUserId } from "@/lib/access";
import { logAdminAction } from "@/lib/admin-data";
import { badRequest, notFound } from "@/lib/api";
import { fetchAndParseFeed } from "@/lib/disctopia-rss";
import { canModerate, requireAdmin } from "@/lib/session";

// Import from a Disctopia feed. mode="preview" → parse + report new/skip counts;
// mode="commit" → insert new rows as drafts (deduped on disctopia_guid).
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(canModerate);
  if (!admin) return notFound();
  const oid = (await getOwnerUserId()) ?? ""; // episodes belong to the owner

  const body = await request.json();
  const mode = body?.mode === "commit" ? "commit" : "preview";
  const showId = String(body?.show_id ?? "");
  const feedUrl = String(body?.feed_url ?? "").trim();
  if (!showId) return badRequest("show_id is required");
  if (!/^https?:\/\//i.test(feedUrl)) return badRequest("a valid feed_url is required");

  const show = await getShowById(showId);
  if (!show) return notFound();

  let feed;
  try {
    feed = await fetchAndParseFeed(feedUrl);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Feed fetch failed");
  }
  if (feed.episodes.length === 0) return badRequest("Feed parsed but found no episodes");

  if (mode === "commit") {
    const result = await importEpisodes(oid, showId, feed.episodes);
    await logAdminAction(admin, "episode.import", { targetType: "show", targetId: showId, meta: { inserted: result.inserted, skipped: result.skipped } });
    return NextResponse.json({ ...result, channelTitle: feed.channelTitle });
  }

  const preview = await buildImportPreview(oid, feed.episodes);
  return NextResponse.json({ channelTitle: feed.channelTitle, ...preview });
}
