import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwner, listOwnerPublicMedia } from "@/db/public";
import { getFlag } from "@/lib/access";

export const dynamic = "force-dynamic";

const TYPE_ICONS: Record<string, string> = {
  book: "\u{1F4D6}", tv_show: "\u{1F4FA}", movie: "\u{1F3AC}", video: "\u{1F4F9}",
  song: "\u{1F3B5}", album: "\u{1F4BF}", podcast: "\u{1F399}", art: "\u{1F3A8}",
  article: "\u{1F4F0}", other: "\u{1F4E6}",
};

const STATUS_LABEL: Record<string, string> = {
  want_to_consume: "Want to", in_progress: "In progress", completed: "Finished", dropped: "Dropped",
};

async function ownerName(): Promise<string> {
  const owner = await getOwner();
  return owner?.name || "Stream.WitUS";
}

export async function generateMetadata(): Promise<Metadata> {
  const name = await ownerName();
  const title = `${name}'s shelf · Stream.WitUS`;
  const description = `What ${name} is reading, watching, and listening to.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    alternates: { types: { "application/rss+xml": "/feed/shelf.xml" } },
  };
}

export default async function ShelfPage() {
  if (!(await getFlag("public_profiles_enabled", true))) notFound();
  const owner = await getOwner();
  const items = owner ? await listOwnerPublicMedia(owner.id) : [];
  const name = owner?.name || "Stream.WitUS";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-fuchsia-300">Stream.WitUS</p>
        <h1 className="text-3xl font-bold">{name}&apos;s shelf</h1>
        <p className="text-neutral-400">Public picks — reading, watching, and listening.</p>
        <div className="flex flex-wrap gap-2 pt-3 text-sm">
          <Link href="/episodes" className="text-fuchsia-400 hover:underline">Episodes</Link>
          <span className="text-neutral-600">·</span>
          <a href="/feed/shelf.xml" className="text-neutral-400 hover:text-white">RSS</a>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="mt-10 text-sm text-neutral-500">Nothing public yet.</p>
      ) : (
        <ul className="mt-8 space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
              {it.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.coverImageUrl} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />
              ) : (
                <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-neutral-800 text-xl">
                  {TYPE_ICONS[it.mediaType] ?? "\u{1F4E6}"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{it.title}</p>
                <p className="truncate text-sm text-neutral-400">
                  {[it.creator, it.mediaType.replace("_", " "), it.yearReleased].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                  <span>{STATUS_LABEL[it.status] ?? it.status}</span>
                  {it.rating != null && <span className="text-amber-400">{"★".repeat(it.rating)}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-12 border-t border-neutral-800 pt-6 text-xs text-neutral-500">
        Tracked on <Link href="/" className="text-fuchsia-400 hover:underline">Stream.WitUS</Link>
      </footer>
    </main>
  );
}
