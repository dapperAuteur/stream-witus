import { NextResponse } from "next/server";
import { contentStats } from "@/lib/admin-data";
import { isOwnerEmail } from "@/lib/access";
import { notFound } from "@/lib/api";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isOwnerEmail(user.email)) return notFound();
  return NextResponse.json({ stats: await contentStats(user.id) });
}
