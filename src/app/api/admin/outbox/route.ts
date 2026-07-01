import { type NextRequest, NextResponse } from "next/server";
import { setFlag } from "@/lib/access";
import { badRequest, notFound } from "@/lib/api";
import { listOutboxLog, logAdminAction, OUTBOX_TRIGGERS, outboxFlags } from "@/lib/admin-data";
import { getOwnerUser } from "@/lib/session";

const ALLOWED_KEYS = new Set<string>(["outbox_enabled", ...OUTBOX_TRIGGERS.map((t) => `outbox_trigger_${t}`)]);

export async function GET() {
  if (!(await getOwnerUser())) return notFound();
  const [flags, log] = await Promise.all([outboxFlags(), listOutboxLog()]);
  return NextResponse.json({ flags, log });
}

export async function PUT(request: NextRequest) {
  const owner = await getOwnerUser();
  if (!owner) return notFound();
  const body = await request.json();
  const key = String(body?.key ?? "");
  if (!ALLOWED_KEYS.has(key) || typeof body?.value !== "boolean") {
    return badRequest("key (a known outbox flag) and boolean value required");
  }
  await setFlag(key, body.value);
  await logAdminAction(owner, "outbox.flag", { targetId: key, meta: { value: body.value } });
  return NextResponse.json({ ok: true, key, value: body.value });
}
