import { type NextRequest, NextResponse } from "next/server";
import { getClubScoped } from "@/db/clubs";
import { badRequest, unauthorized } from "@/lib/api";
import { slugify } from "@/lib/slug";

export async function GET() {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const clubs = await cdb.listClubs();
  return NextResponse.json({ clubs });
}

export async function POST(request: NextRequest) {
  const cdb = await getClubScoped();
  if (!cdb) return unauthorized();
  const body = await request.json();
  if (!body?.name?.trim()) return badRequest("name is required");
  const slug = (body.slug?.trim() ? slugify(body.slug) : slugify(body.name)) || slugify(`club-${Date.now()}`);
  try {
    const club = await cdb.createClub({
      name: body.name.trim(),
      slug,
      description: body.description?.trim() || null,
      visibility: body.visibility === "public" ? "public" : "private",
    });
    return NextResponse.json({ club }, { status: 201 });
  } catch {
    return badRequest("Could not create club — the slug may already be taken");
  }
}
