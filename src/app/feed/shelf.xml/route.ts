import { getOwner, listOwnerPublicMedia } from "@/db/public";
import { env } from "@/lib/env";
import { buildRss, rssResponse } from "@/lib/rss";

export const dynamic = "force-dynamic";

const VERB: Record<string, string> = {
  book: "Reading", article: "Reading", art: "Viewing",
  movie: "Watching", tv_show: "Watching", video: "Watching",
  song: "Listening to", album: "Listening to", podcast: "Listening to",
};

// The owner's public "diary" — what they're reading/watching/listening to.
export async function GET() {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const owner = await getOwner();
  const name = owner?.name ?? "Stream.WitUS";
  const items = owner ? await listOwnerPublicMedia(owner.id) : [];

  const xml = buildRss({
    title: `${name}'s shelf`,
    link: `${base}/shelf`,
    description: `What ${name} is reading, watching, and listening to.`,
    selfUrl: `${base}/feed/shelf.xml`,
    items: items.map((it) => {
      const verb = VERB[it.mediaType] ?? "Tracking";
      const by = it.creator ? ` by ${it.creator}` : "";
      const rating = it.rating ? ` ${"★".repeat(it.rating)}` : "";
      return {
        title: `${verb}: ${it.title}${by}`,
        link: `${base}/shelf`,
        guid: it.id,
        description: `${it.status.replace(/_/g, " ")}${rating}`.trim(),
        pubDate: it.updatedAt ? new Date(it.updatedAt) : null,
      };
    }),
  });
  return rssResponse(xml);
}
