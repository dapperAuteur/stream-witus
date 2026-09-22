import { type NextRequest, NextResponse } from "next/server";
import { getScopedDb } from "@/db/scoped";
import { badRequest, unauthorized } from "@/lib/api";
import { csvToMediaItems, type MediaImportResult, mediaDedupeKey, splitDuplicates } from "@/lib/csv";

const MAX_ROWS = 500;

/**
 * Import media items from a CSV (a Stream.WitUS or CentenarianOS export). Safe to run
 * twice: rows matching an item the user already has (same title, media type and year)
 * or repeating an earlier row of the same file are skipped and reported as duplicates.
 * Responds with a MediaImportResult.
 */
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
    const body: unknown = await request.json().catch(() => null);
    const csv = (body as { csv?: unknown } | null)?.csv;
    if (typeof csv !== "string") return badRequest("csv is required");
    text = csv;
  }

  const { rows, rejected, missingColumns } = csvToMediaItems(text);
  if (missingColumns.length > 0) {
    return badRequest(
      `The CSV has no ${missingColumns.join(" or ")} column. Check that the first row is the header row.`,
    );
  }
  const totalRows = rows.length + rejected.length;
  if (totalRows === 0) return badRequest("The CSV has a header row but no items.");
  if (totalRows > MAX_ROWS) {
    return badRequest(`Too many rows (${totalRows}). Import at most ${MAX_ROWS} at a time.`);
  }

  const mediaTypes = [...new Set(rows.map((r) => r.item.mediaType))];
  const existing = await sdb.listMediaIdentities(mediaTypes);
  const { unique, duplicates } = splitDuplicates(rows, new Set(existing.map(mediaDedupeKey)));

  const { inserted } = await sdb.importMediaItems(unique.map((r) => r.item));
  const result: MediaImportResult = { inserted, duplicates, rejected };
  return NextResponse.json(result);
}
