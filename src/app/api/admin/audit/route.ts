import { NextResponse } from "next/server";
import { listAuditLog } from "@/lib/admin-data";
import { notFound } from "@/lib/api";
import { getOwnerUser } from "@/lib/session";

export async function GET() {
  if (!(await getOwnerUser())) return notFound();
  return NextResponse.json({ entries: await listAuditLog() });
}
