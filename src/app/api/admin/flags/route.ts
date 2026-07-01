import { type NextRequest, NextResponse } from "next/server";
import { setFlag } from "@/lib/access";
import { FEATURE_FLAGS, featureFlags, logAdminAction } from "@/lib/admin-data";
import { badRequest, notFound } from "@/lib/api";
import { canManageSettings, canView, requireAdmin } from "@/lib/session";

const KEYS = new Set<string>(FEATURE_FLAGS.map((f) => f.key));

export async function GET() {
  if (!(await requireAdmin(canView))) return notFound();
  return NextResponse.json({ flags: await featureFlags(), defs: FEATURE_FLAGS });
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(canManageSettings);
  if (!admin) return notFound();
  const body = await request.json();
  const key = String(body?.key ?? "");
  if (!KEYS.has(key) || typeof body?.value !== "boolean") return badRequest("known flag key + boolean value required");
  await setFlag(key, body.value);
  await logAdminAction(admin, "flag.set", { targetId: key, meta: { value: body.value } });
  return NextResponse.json({ ok: true, key, value: body.value });
}
