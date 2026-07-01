import Link from "next/link";
import { notFound } from "next/navigation";
import AdminPanel from "@/components/admin/AdminPanel";
import { getSessionUser } from "@/lib/session";
import { isOwnerEmail } from "@/lib/access";

// Owner-only. Non-owners 404 (the layout already gates auth). Not statically
// prerendered — it reads the session + live waitlist.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || !isOwnerEmail(user.email)) notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">Signed in as {user.email} (owner).</p>
      </div>
      <Link href="/dashboard/admin/episodes"
        className="block bg-white border border-gray-200 rounded-2xl p-5 hover:border-fuchsia-300 transition">
        <h2 className="text-sm font-semibold text-gray-700">Podcast episodes →</h2>
        <p className="text-xs text-gray-500 mt-0.5">Import from Disctopia, manage, and publish across shows.</p>
      </Link>
      <AdminPanel ownerId={user.id} />
    </div>
  );
}
