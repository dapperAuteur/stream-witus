import { type NextRequest, NextResponse } from "next/server";
import { setFlag, isOwnerEmail } from "@/lib/access";
import { badRequest, notFound } from "@/lib/api";
import { listOutboxLog, OUTBOX_TRIGGERS, outboxFlags } from "@/lib/admin-data";
import { getSessionUser } from "@/lib/session";

async function requireOwner() {
  const user = await getSessionUser();
  return user && isOwnerEmail(user.email);
}

const ALLOWED_KEYS = new Set<string>(["outbox_enabled", ...OUTBOX_TRIGGERS.map((t) => `outbox_trigger_${t}`)]);

export async function GET() {
  if (!(await requireOwner())) return notFound();
  const [flags, log] = await Promise.all([outboxFlags(), listOutboxLog()]);
  return NextResponse.json({ flags, log });
}

export async function PUT(request: NextRequest) {
  if (!(await requireOwner())) return notFound();
  const body = await request.json();
  const key = String(body?.key ?? "");
  if (!ALLOWED_KEYS.has(key) || typeof body?.value !== "boolean") {
    return badRequest("key (a known outbox flag) and boolean value required");
  }
  await setFlag(key, body.value);
  return NextResponse.json({ ok: true, key, value: body.value });
}
