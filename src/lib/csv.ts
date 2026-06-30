import Papa from "papaparse";
import type { MediaItemInput } from "@/db/scoped";
import { MEDIA_STATUSES, MEDIA_TYPES, VISIBILITIES } from "@/db/schema/media";
import { toStringArray } from "./api";

// CSV column order for export. Arrays (genre/tags) are joined with `;` — the same
// delimiter toStringArray() splits on, so an exported file round-trips on import.
const COLUMNS = [
  "title",
  "creator",
  "media_type",
  "status",
  "rating",
  "genre",
  "tags",
  "cover_image_url",
  "external_url",
  "start_date",
  "end_date",
  "year_released",
  "source_platform",
  "current_progress",
  "total_length",
  "visibility",
  "is_favorite",
  "notes",
] as const;

type ExportRow = Record<(typeof COLUMNS)[number], string>;

export function itemsToCsv(items: Array<Record<string, unknown>>): string {
  const rows: ExportRow[] = items.map((it) => {
    const row = {} as ExportRow;
    for (const col of COLUMNS) {
      const v = it[snakeToCamel(col)];
      row[col] = Array.isArray(v) ? v.join(";") : v == null ? "" : String(v);
    }
    return row;
  });
  return Papa.unparse({ fields: [...COLUMNS], data: rows });
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

const isMediaType = (v: string): v is (typeof MEDIA_TYPES)[number] =>
  (MEDIA_TYPES as readonly string[]).includes(v);
const isStatus = (v: string): v is (typeof MEDIA_STATUSES)[number] =>
  (MEDIA_STATUSES as readonly string[]).includes(v);
const isVisibility = (v: string): v is (typeof VISIBILITIES)[number] =>
  (VISIBILITIES as readonly string[]).includes(v);

/** Parse a CSV file into validated MediaItemInputs. Skips rows missing title/type. */
export function csvToMediaItems(text: string): { rows: MediaItemInput[]; skipped: number } {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  const rows: MediaItemInput[] = [];
  let skipped = 0;
  for (const r of parsed.data) {
    const title = r.title?.trim();
    const mediaType = r.media_type?.trim();
    if (!title || !mediaType || !isMediaType(mediaType)) {
      skipped += 1;
      continue;
    }
    const ratingNum = r.rating ? Number(r.rating) : null;
    rows.push({
      title,
      mediaType,
      creator: r.creator || null,
      status: r.status && isStatus(r.status) ? r.status : "want_to_consume",
      rating: ratingNum && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : null,
      genre: toStringArray(r.genre),
      tags: toStringArray(r.tags),
      coverImageUrl: r.cover_image_url || null,
      externalUrl: r.external_url || null,
      startDate: r.start_date || null,
      endDate: r.end_date || null,
      yearReleased: r.year_released ? Number(r.year_released) : null,
      sourcePlatform: r.source_platform || null,
      currentProgress: r.current_progress || null,
      totalLength: r.total_length || null,
      visibility: r.visibility && isVisibility(r.visibility) ? r.visibility : "private",
      isFavorite: r.is_favorite === "true",
      notes: r.notes || null,
    });
  }
  return { rows, skipped };
}
