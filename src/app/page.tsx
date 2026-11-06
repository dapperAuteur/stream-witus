import Link from "next/link";
import { getShellSession } from "@/lib/shell-session";

export default async function Home() {
  // Same cached lookup the root layout's header already made for this request.
  const { signedIn } = await getShellSession();

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Stream.WitUS</h1>
        <p className="text-neutral-400">
          Cross-media tracker + companion for the <em>All The Spoilers</em> podcast, plus the
          ReadWitUS book club.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href={signedIn ? "/dashboard/media" : "/signin"}
          className="inline-flex min-h-11 items-center rounded-lg bg-fuchsia-600 px-4 text-sm font-medium text-white transition hover:bg-fuchsia-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
        >
          {signedIn ? "Open my media" : "Sign in"}
        </Link>
        <Link
          href="/episodes"
          className="inline-flex min-h-11 items-center rounded-lg border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-fuchsia-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
        >
          Episodes
        </Link>
        <Link
          href="/clubs"
          className="inline-flex min-h-11 items-center rounded-lg border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-fuchsia-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
        >
          Book clubs
        </Link>
      </div>
    </main>
  );
}
