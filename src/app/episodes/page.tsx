import type { Metadata } from "next";
import Link from "next/link";
import { listPublicEpisodes } from "@/db/public";

// Reads live published episodes per request (no build-time DB, always fresh).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Episodes · All The Spoilers · Stream.WitUS",
  description: "Public show notes for the All The Spoilers podcast — books, movies, and TV.",
  alternates: { types: { "application/rss+xml": "/feed/episodes.xml" } },
};

function epTag(season: number | null, num: number | null): string | null {
  if (num == null) return null;
  return season != null ? `S${season}E${num}` : `#${num}`;
}

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PublicEpisodesPage() {
  const episodes = await listPublicEpisodes();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-fuchsia-300">
          All The Spoilers
        </p>
        <h1 className="text-3xl font-bold">Episodes</h1>
        <p className="text-neutral-400">Show notes for the books, movies, and TV we cover.</p>
        <div className="flex flex-wrap gap-2 pt-3">
          <Link href="/connect" className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition hover:border-fuchsia-500">
            Be on the show →
          </Link>
          <Link href="/pitch" className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition hover:border-fuchsia-500">
            Pitch your media →
          </Link>
          <a href="/feed/episodes.xml" className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition hover:border-fuchsia-500">
            RSS
          </a>
        </div>
      </header>

      {episodes.length === 0 ? (
        <p className="mt-10 text-sm text-neutral-500">No published episodes yet — check back soon.</p>
      ) : (
        <ul className="mt-8 space-y-2">
          {episodes.map((ep) => {
            const tag = epTag(ep.seasonNumber, ep.episodeNumber);
            const aired = fmtDate(ep.airDate);
            return (
              <li key={ep.id}>
                <Link
                  href={`/episodes/${ep.id}`}
                  className="block rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition hover:border-fuchsia-500/50"
                >
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    {tag && <span className="font-mono">{tag}</span>}
                    {aired && <span>{aired}</span>}
                    {ep.durationMin && <span>{ep.durationMin} min</span>}
                  </div>
                  <h2 className="mt-0.5 font-semibold text-white">{ep.title}</h2>
                  {ep.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-400">{ep.description}</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
