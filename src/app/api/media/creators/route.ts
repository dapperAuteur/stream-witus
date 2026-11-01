import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { badRequest, unauthorized } from "@/lib/api";
import { toApiNamedCount } from "@/lib/media-api";

export async function GET() {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  // CentOS contract: a bare array (the autocomplete + settings UI expect this).
  const creators = await sdb.listCreators();
  return NextResponse.json(creators.map(toApiNamedCount));
}

export async function POST(request: NextRequest) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const body = await request.json();
  if (!body?.name?.trim()) return badRequest("name is required");
  // Upsert: reusing a name bumps use_count (autocomplete ranking). Bare row out.
  const creator = await sdb.upsertCreator(body.name.trim());
  return NextResponse.json(toApiNamedCount(creator), { status: 201 });
}
