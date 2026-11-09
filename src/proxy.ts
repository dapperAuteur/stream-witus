import { NextResponse, type NextRequest } from "next/server";
import { PATH_HEADER } from "@/lib/return-to";

/**
 * Tells the /dashboard layout which path it is guarding, so a signed-out visitor is sent to
 * `/signin?next=<that path>` and lands back on it after signing in (a 401 "sends the visitor to
 * sign in and back", witus docs/shared-ui-ux-dx.md). Layouts cannot read the request path
 * themselves, hence a request header.
 *
 * This file makes no auth decision. The session check stays in src/app/dashboard/layout.tsx and
 * every route keeps its own owner-scoped gate. The header is always overwritten here, so a value a
 * client sends is never what the layout reads, and the layout still runs it through
 * `safeReturnPath` before using it.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
