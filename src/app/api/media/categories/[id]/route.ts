import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { badRequest, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  const updates: { name?: string; icon?: string | null; color?: string; sortOrder?: number } = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.icon !== undefined) updates.icon = body.icon;
  if (body.color !== undefined) updates.color = body.color;
  if (body.sort_order !== undefined) updates.sortOrder = body.sort_order;
  if (Object.keys(updates).length === 0) return badRequest("No valid fields to update");

  const category = await sdb.updateCategory(id, updates);
  if (!category) return notFound();
  return NextResponse.json({ category });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const { id } = await params;
  const ok = await sdb.deleteCategory(id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
