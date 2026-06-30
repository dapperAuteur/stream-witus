import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { badRequest, unauthorized } from "@/lib/api";
import { csvToMediaItems } from "@/lib/csv";

const MAX_ROWS = 500;

export async function POST(request: NextRequest) {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();

  // Accept either a multipart file upload or a JSON { csv } body.
  let text: string;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("file is required");
    text = await file.text();
  } else {
    const body = await request.json();
    if (typeof body?.csv !== "string") return badRequest("csv is required");
    text = body.csv;
  }

  const { rows, skipped } = csvToMediaItems(text);
  if (rows.length === 0) return badRequest("No valid rows found in CSV");
  if (rows.length > MAX_ROWS) return badRequest(`Too many rows (max ${MAX_ROWS})`);

  const { inserted } = await sdb.importMediaItems(rows);
  return NextResponse.json({ inserted, skipped });
}
