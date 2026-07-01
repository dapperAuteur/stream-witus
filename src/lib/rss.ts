// Minimal RSS 2.0 builder for the content feeds (episodes show notes, public
// shelf). Not the iTunes-spec podcast feed — that's a larger future task
// (plans/future/05). Dependency-free.

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  description?: string | null;
  pubDate?: Date | null;
}

export interface RssChannel {
  title: string;
  link: string;
  description: string;
  /** Absolute URL of this feed, for the atom:self link. */
  selfUrl: string;
  items: RssItem[];
}

export function buildRss(ch: RssChannel): string {
  const items = ch.items
    .map((it) =>
      [
        "    <item>",
        `      <title>${esc(it.title)}</title>`,
        `      <link>${esc(it.link)}</link>`,
        `      <guid isPermaLink="false">${esc(it.guid)}</guid>`,
        it.description ? `      <description>${esc(it.description)}</description>` : "",
        it.pubDate ? `      <pubDate>${it.pubDate.toUTCString()}</pubDate>` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${esc(ch.title)}</title>`,
    `    <link>${esc(ch.link)}</link>`,
    `    <description>${esc(ch.description)}</description>`,
    `    <atom:link href="${esc(ch.selfUrl)}" rel="self" type="application/rss+xml" />`,
    items,
    "  </channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n");
}

export function rssResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
