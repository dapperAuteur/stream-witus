import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { badRequest, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  if (!body?.name?.trim()) return badRequest("name is required");
  const platform = await sdb.updatePlatform(id, body.name.trim());
  if (!platform) return notFound();
  return NextResponse.json({ platform });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const ok = await sdb.deletePlatform(id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
