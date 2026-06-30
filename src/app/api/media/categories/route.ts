import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { badRequest, unauthorized } from "@/lib/api";

export async function GET() {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  // Auto-seeds the six default categories on first read (CentOS parity).
  const categories = await sdb.listCategories();
  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const body = await request.json();
  if (!body?.name?.trim()) return badRequest("name is required");
  const category = await sdb.createCategory({
    name: body.name.trim(),
    icon: body.icon ?? null,
    color: body.color ?? undefined,
    sortOrder: body.sort_order ?? undefined,
  });
  return NextResponse.json({ category }, { status: 201 });
}
