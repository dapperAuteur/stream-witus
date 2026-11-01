import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { badRequest, unauthorized } from "@/lib/api";
import { toApiNamedCount } from "@/lib/media-api";

export async function GET() {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const platforms = await sdb.listPlatforms();
  return NextResponse.json(platforms.map(toApiNamedCount));
}

export async function POST(request: NextRequest) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const body = await request.json();
  if (!body?.name?.trim()) return badRequest("name is required");
  const platform = await sdb.upsertPlatform(body.name.trim());
  return NextResponse.json(toApiNamedCount(platform), { status: 201 });
}
