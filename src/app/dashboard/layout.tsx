import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import SignOutButton from "@/components/SignOutButton";

// Owner gate: every /dashboard route requires a session. Unauthenticated → /signin.
// (Per-route data is still owner-scoped via ScopedDb; this is the UX gate.)
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/signin");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/dashboard/media" className="text-sm font-bold text-gray-900">
            Stream.WitUS
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
