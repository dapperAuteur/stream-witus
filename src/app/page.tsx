import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Stream.WitUS</h1>
        <p className="text-neutral-400">
          Cross-media tracker + companion for the <em>All The Spoilers</em> podcast, plus the
          ReadWitUS book club.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/signin"
          className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-fuchsia-700"
        >
          Sign in
        </Link>
        <Link
          href="/episodes"
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 transition hover:border-fuchsia-500"
        >
          Episodes
        </Link>
      </div>
    </main>
  );
}
