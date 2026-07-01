import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ROADMAP_MD } from "@/lib/roadmap";
import { canView, requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

// Admin-only in-app roadmap (plans/future/01). Renders the committed snapshot.
export default async function AdminRoadmapPage() {
  if (!(await requireAdmin(canView))) notFound();
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link href="/dashboard/admin" className="text-sm text-gray-500 hover:text-gray-900">← Admin</Link>
      <article className="prose prose-sm prose-neutral max-w-none rounded-2xl border border-gray-200 bg-white p-6
        prose-headings:font-bold prose-h1:text-2xl prose-h2:text-base prose-h2:mt-5 prose-li:my-0.5
        prose-a:text-fuchsia-600 prose-code:text-fuchsia-700 prose-code:bg-fuchsia-50 prose-code:px-1 prose-code:rounded">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{ROADMAP_MD}</ReactMarkdown>
      </article>
    </div>
  );
}
