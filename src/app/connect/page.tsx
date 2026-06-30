import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/forms/ContactForm";

export const metadata: Metadata = {
  title: "Be on the show · All The Spoilers · Stream.WitUS",
  description: "Pitch yourself as a guest or co-host on the All The Spoilers podcast.",
};

export default function ConnectPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href="/episodes" className="text-sm text-neutral-400 hover:text-white">← Episodes</Link>
      <h1 className="mt-6 text-3xl font-bold">Be on the show</h1>
      <p className="mt-2 text-neutral-400">
        Want to join <em>All The Spoilers</em> as a guest or co-host? Tell us a bit about you.
      </p>
      <div className="mt-8">
        <ContactForm />
      </div>
    </main>
  );
}
