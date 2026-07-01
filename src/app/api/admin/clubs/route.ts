import { type NextRequest, NextResponse } from "next/server";
import { listPublicClubsForMod, setClubFeatured } from "@/db/moderation";
import { logAdminAction } from "@/lib/admin-data";
import { badRequest, notFound } from "@/lib/api";
import { canModerate, canView, requireAdmin } from "@/lib/session";

export async function GET() {
  if (!(await requireAdmin(canView))) return notFound();
  return NextResponse.json({ clubs: await listPublicClubsForMod() });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(canModerate);
  if (!admin) return notFound();
  const body = await request.json();
  if (!body?.id || typeof body?.featured !== "boolean") return badRequest("id + featured (boolean) required");
  const ok = await setClubFeatured(body.id, body.featured);
  if (!ok) return notFound();
  await logAdminAction(admin, body.featured ? "club.feature" : "club.unfeature", { targetType: "club", targetId: body.id });
  return NextResponse.json({ ok: true });
}
