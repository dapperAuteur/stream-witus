import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PATH_HEADER, signInHref } from "@/lib/return-to";
import { getSessionUserId } from "@/lib/session";

// Auth gate: every /dashboard route requires a session. Signed out → /signin?next=<this path>, so
// signing in lands back here (src/proxy.ts supplies the path). Per-route data is still
// owner-scoped via ScopedDb; this is the UX gate.
//
// The navigation (My media, My clubs, Admin) and the sign-out controls moved to the site header in
// the root layout, which every page shares; this layout keeps only the gate and the light surface
// the dashboard pages are styled for.
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const userId = await getSessionUserId();
  if (!userId) redirect(signInHref((await headers()).get(PATH_HEADER)));

  return (
    <div className="min-h-[70vh] bg-gray-50 text-gray-900">
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
