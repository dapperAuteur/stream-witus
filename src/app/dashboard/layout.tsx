import Link from "next/link";
import { redirect } from "next/navigation";
import { witusEndSessionEndpoint } from "@/lib/env";
import { getAdminUser, getSessionUserId } from "@/lib/session";
import SignOutButton, { SignOutEverywhereButton } from "@/components/SignOutButton";

// Auth gate: every /dashboard route requires a session. Unauthenticated → /signin.
// (Per-route data is still owner-scoped via ScopedDb; this is the UX gate.)
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/signin");
  const admin = await getAdminUser();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav className="flex items-center gap-4">
            <Link href="/dashboard/media" className="text-sm font-bold text-gray-900">
              Stream.WitUS
            </Link>
            <Link href="/dashboard/media" className="text-sm text-gray-500 hover:text-gray-900">
              Media
            </Link>
            <Link href="/dashboard/clubs" className="text-sm text-gray-500 hover:text-gray-900">
              Clubs
            </Link>
            {admin && (
              <Link href="/dashboard/admin" className="text-sm text-gray-500 hover:text-gray-900">
                Admin
              </Link>
            )}
          </nav>
          <div className="flex items-start gap-4">
            {/* "Sign out" leaves only Stream.WitUS (BAM, 2026-10-29, witus task 128 option (b)). */}
            <SignOutButton />
            {/* Resolved on the server; null unless this app is a configured WitUS OIDC client,
                and then the "everywhere" control does not render. */}
            <SignOutEverywhereButton endSessionUrl={witusEndSessionEndpoint} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
