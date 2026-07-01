import { type NextRequest, NextResponse } from "next/server";
import { listRecentPosts, setPostRemoved } from "@/db/moderation";
import { logAdminAction } from "@/lib/admin-data";
import { badRequest, notFound } from "@/lib/api";
import { canModerate, canView, requireAdmin } from "@/lib/session";

export async function GET() {
  if (!(await requireAdmin(canView))) return notFound();
  return NextResponse.json({ posts: await listRecentPosts() });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(canModerate);
  if (!admin) return notFound();
  const body = await request.json();
  if (!body?.id || typeof body?.removed !== "boolean") return badRequest("id + removed (boolean) required");
  const ok = await setPostRemoved(body.id, body.removed);
  if (!ok) return notFound();
  await logAdminAction(admin, body.removed ? "post.remove" : "post.restore", { targetType: "post", targetId: body.id });
  return NextResponse.json({ ok: true });
}
