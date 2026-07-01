import { NextResponse } from "next/server";
import { contentStats } from "@/lib/admin-data";
import { notFound } from "@/lib/api";
import { canView, requireAdmin } from "@/lib/session";

export async function GET() {
  if (!(await requireAdmin(canView))) return notFound();
  return NextResponse.json({ stats: await contentStats() });
}
