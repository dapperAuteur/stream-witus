import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { badRequest, unauthorized } from "@/lib/api";

export async function GET() {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const creators = await sdb.listCreators();
  return NextResponse.json({ creators });
}

export async function POST(request: NextRequest) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const body = await request.json();
  if (!body?.name?.trim()) return badRequest("name is required");
  // Upsert: reusing a name bumps use_count (autocomplete ranking).
  const creator = await sdb.upsertCreator(body.name.trim());
  return NextResponse.json({ creator }, { status: 201 });
}
