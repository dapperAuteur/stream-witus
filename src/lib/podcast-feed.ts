// iTunes-spec podcast RSS builder (plans/future/05). Distinct from lib/rss.ts
// (the plain content feeds) — this one carries the itunes: namespace + <enclosure>
// so Apple Podcasts / Spotify can consume it. Dependency-free.

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface PodcastChannel {
  title: string;
  link: string; // public site link for the show
  selfUrl: string; // absolute URL of this feed
  description: string;
  author: string | null;
  ownerEmail: string | null;
  category: string | null;
  language: string;
  explicit: boolean;
  artworkUrl: string | null;
}

export interface PodcastItem {
  guid: string;
  title: string;
  description: string | null;
  link: string | null;
  pubDate: Date | null;
  episodeNumber: number | null;
  durationMin: number | null;
  audioUrl: string;
  audioLengthBytes: number | null;
  audioMime: string | null;
  artworkUrl: string | null;
  explicit: boolean;
}

const yn = (b: boolean) => (b ? "true" : "false");

export function buildPodcastFeed(ch: PodcastChannel, items: PodcastItem[]): string {
  const channelBits = [
    `    <title>${esc(ch.title)}</title>`,
    `    <link>${esc(ch.link)}</link>`,
    `    <language>${esc(ch.language)}</language>`,
    `    <description>${esc(ch.description)}</description>`,
    ch.author ? `    <itunes:author>${esc(ch.author)}</itunes:author>` : "",
    ch.artworkUrl ? `    <itunes:image href="${esc(ch.artworkUrl)}" />` : "",
    ch.category ? `    <itunes:category text="${esc(ch.category)}" />` : "",
    `    <itunes:explicit>${yn(ch.explicit)}</itunes:explicit>`,
    ch.ownerEmail
      ? `    <itunes:owner><itunes:name>${esc(ch.author ?? ch.title)}</itunes:name><itunes:email>${esc(ch.ownerEmail)}</itunes:email></itunes:owner>`
      : "",
    `    <atom:link href="${esc(ch.selfUrl)}" rel="self" type="application/rss+xml" />`,
  ].filter(Boolean);

  const itemBits = items.map((it) =>
    [
      "    <item>",
      `      <title>${esc(it.title)}</title>`,
      `      <guid isPermaLink="false">${esc(it.guid)}</guid>`,
      it.link ? `      <link>${esc(it.link)}</link>` : "",
      it.pubDate ? `      <pubDate>${it.pubDate.toUTCString()}</pubDate>` : "",
      it.description ? `      <description>${esc(it.description)}</description>` : "",
      `      <enclosure url="${esc(it.audioUrl)}" length="${it.audioLengthBytes ?? 0}" type="${esc(it.audioMime ?? "audio/mpeg")}" />`,
      it.durationMin ? `      <itunes:duration>${it.durationMin * 60}</itunes:duration>` : "",
      it.episodeNumber != null ? `      <itunes:episode>${it.episodeNumber}</itunes:episode>` : "",
      it.artworkUrl ? `      <itunes:image href="${esc(it.artworkUrl)}" />` : "",
      `      <itunes:explicit>${yn(it.explicit)}</itunes:explicit>`,
      "    </item>",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    ...channelBits,
    ...itemBits,
    "  </channel>",
    "</rss>",
  ].join("\n");
}
