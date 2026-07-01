import { notFound } from "next/navigation";
import { getPublicShow, listShowFeedEpisodes } from "@/db/public";
import { env } from "@/lib/env";
import { buildPodcastFeed } from "@/lib/podcast-feed";
import { rssResponse } from "@/lib/rss";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

// The canonical iTunes-spec podcast feed per show (plans/future/05). Inert until
// BAM points Apple/Spotify at it (the cutover). Only PUBLISHED episodes with an
// audio enclosure appear.
export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const show = await getPublicShow(slug);
  if (!show) notFound();

  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const episodes = await listShowFeedEpisodes(show.id);
  const items = episodes
    .filter((e) => e.audioUrl) // an item without audio can't be a valid enclosure
    .map((e) => ({
      guid: e.disctopiaGuid ?? e.id,
      title: e.title,
      description: e.description ?? e.showNotesExcerpt ?? e.showNotes,
      link: e.externalUrl ?? `${base}/episodes/${e.id}`,
      pubDate: e.publishedAt ?? e.createdAt,
      episodeNumber: e.episodeNumber,
      durationMin: e.durationMin,
      audioUrl: e.audioUrl as string,
      audioLengthBytes: e.audioLengthBytes,
      audioMime: e.audioMime,
      artworkUrl: e.artworkUrl ?? show.artworkUrl,
      explicit: show.explicit,
    }));

  const xml = buildPodcastFeed(
    {
      title: show.name,
      link: `${base}/episodes`,
      selfUrl: `${base}/feed/podcast/${show.slug}/rss.xml`,
      description: show.description ?? `${show.name} podcast.`,
      author: show.author,
      ownerEmail: show.ownerEmail,
      category: show.category,
      language: show.language,
      explicit: show.explicit,
      artworkUrl: show.artworkUrl,
    },
    items,
  );
  return rssResponse(xml);
}
