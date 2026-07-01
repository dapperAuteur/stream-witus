import { listPublicEpisodes } from "@/db/public";
import { env } from "@/lib/env";
import { buildRss, rssResponse } from "@/lib/rss";

export const dynamic = "force-dynamic";

// Content feed for the All The Spoilers show notes (public, published episodes).
export async function GET() {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const episodes = await listPublicEpisodes();
  const xml = buildRss({
    title: "All The Spoilers — Show Notes",
    link: `${base}/episodes`,
    description: "Show notes for the All The Spoilers podcast — books, movies, and TV.",
    selfUrl: `${base}/feed/episodes.xml`,
    items: episodes.map((ep) => ({
      title: ep.title,
      link: `${base}/episodes/${ep.id}`,
      guid: ep.id,
      description: ep.description,
      pubDate: ep.airDate ? new Date(`${ep.airDate}T12:00:00Z`) : null,
    })),
  });
  return rssResponse(xml);
}
