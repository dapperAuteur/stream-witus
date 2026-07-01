import { notFound } from "next/navigation";
import Link from "next/link";
import EpisodesAdmin from "@/components/admin/EpisodesAdmin";
import { getSessionUser } from "@/lib/session";
import { isOwnerEmail } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function AdminEpisodesPage() {
  const user = await getSessionUser();
  if (!user || !isOwnerEmail(user.email)) notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/dashboard/admin" className="text-sm text-gray-500 hover:text-gray-900">← Admin</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Podcast episodes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Import from Disctopia, manage, and publish across shows. Publishing fires a social draft.
        </p>
      </div>
      <EpisodesAdmin />
    </div>
  );
}
