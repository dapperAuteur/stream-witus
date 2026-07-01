import Link from "next/link";
import { notFound } from "next/navigation";
import AdminPanel from "@/components/admin/AdminPanel";
import AuditPanel from "@/components/admin/AuditPanel";
import FlagsPanel from "@/components/admin/FlagsPanel";
import HealthPanel from "@/components/admin/HealthPanel";
import InboxPanel from "@/components/admin/InboxPanel";
import MembersPanel from "@/components/admin/MembersPanel";
import OutboxPanel from "@/components/admin/OutboxPanel";
import StatsPanel from "@/components/admin/StatsPanel";
import { canManageSettings, canManageUsers, canModerate, getAdminUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) notFound();
  const { role } = admin;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">Signed in as {admin.email} · role: {role}.</p>
      </div>

      <StatsPanel />
      <HealthPanel />

      {canModerate(role) && (
        <Link href="/dashboard/admin/episodes"
          className="block bg-white border border-gray-200 rounded-2xl p-5 hover:border-fuchsia-300 transition">
          <h2 className="text-sm font-semibold text-gray-700">Podcast episodes →</h2>
          <p className="text-xs text-gray-500 mt-0.5">Import from Disctopia, manage, publish/unpublish across shows.</p>
        </Link>
      )}

      <InboxPanel />
      <OutboxPanel />

      {canManageSettings(role) && <FlagsPanel />}
      {canManageSettings(role) && <AdminPanel ownerId={admin.id} />}
      {canManageUsers(role) && <MembersPanel />}

      <AuditPanel />
    </div>
  );
}
