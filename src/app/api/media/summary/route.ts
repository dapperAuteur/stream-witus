import { NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { unauthorized } from "@/lib/api";

export async function GET() {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  // CentOS contract: stats at the top level (the hub reads d.totalItems etc.).
  const summary = await sdb.summary();
  return NextResponse.json(summary);
}
