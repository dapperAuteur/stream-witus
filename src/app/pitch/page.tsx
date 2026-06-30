import type { Metadata } from "next";
import Link from "next/link";
import PitchForm from "@/components/forms/PitchForm";

export const metadata: Metadata = {
  title: "Pitch your media · All The Spoilers · Stream.WitUS",
  description: "Tell us about your book, podcast, movie, TV show, or music to feature on the show.",
};

export default function PitchPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href="/episodes" className="text-sm text-neutral-400 hover:text-white">← Episodes</Link>
      <h1 className="mt-6 text-3xl font-bold">Pitch your media</h1>
      <p className="mt-2 text-neutral-400">
        Have a book, podcast, movie, TV show, or music you&apos;d like us to cover? Send it our way.
      </p>
      <div className="mt-8">
        <PitchForm />
      </div>
    </main>
  );
}
