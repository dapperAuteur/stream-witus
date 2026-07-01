import Link from "next/link";
import { notFound } from "next/navigation";
import ModerationPanel from "@/components/admin/ModerationPanel";
import { canModerate, requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  if (!(await requireAdmin(canModerate))) notFound();
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/dashboard/admin" className="text-sm text-gray-500 hover:text-gray-900">← Admin</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Moderation</h1>
        <p className="text-sm text-gray-500 mt-0.5">Feature public clubs and take down discussion posts.</p>
      </div>
      <ModerationPanel />
    </div>
  );
}
