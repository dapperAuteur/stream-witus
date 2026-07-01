import { type NextRequest, NextResponse } from "next/server";
import { listShows, updateShowConfig } from "@/db/episodes-admin";
import { logAdminAction } from "@/lib/admin-data";
import { badRequest, notFound } from "@/lib/api";
import { canManageSettings, canView, requireAdmin } from "@/lib/session";

export async function GET() {
  if (!(await requireAdmin(canView))) return notFound();
  return NextResponse.json({ shows: await listShows() });
}

const FIELD_MAP: Record<string, string> = {
  description: "description",
  author: "author",
  owner_email: "ownerEmail",
  category: "category",
  language: "language",
  explicit: "explicit",
  artwork_url: "artworkUrl",
};

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(canManageSettings);
  if (!admin) return notFound();
  const body = await request.json();
  if (!body?.id) return badRequest("id is required");
  const cfg: Record<string, unknown> = {};
  for (const [k, field] of Object.entries(FIELD_MAP)) {
    if (body[k] !== undefined) cfg[field] = body[k];
  }
  if (Object.keys(cfg).length === 0) return badRequest("No valid fields to update");
  const show = await updateShowConfig(body.id, cfg);
  if (!show) return notFound();
  await logAdminAction(admin, "show.config", { targetType: "show", targetId: body.id });
  return NextResponse.json({ show });
}
