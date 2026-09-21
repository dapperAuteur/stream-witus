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
  "season_number",
  "episode_number",
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

/** A CSV row that was not imported. `row` is the spreadsheet row number (header = row 1). */
export interface CsvRowIssue {
  row: number;
  title: string | null;
  reason: string;
}

/** A row that parsed cleanly, still tagged with its spreadsheet row number. */
export interface ParsedCsvRow {
  row: number;
  item: MediaItemInput;
}

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  rejected: CsvRowIssue[];
  /** Required header columns absent from the file. Non-empty means nothing was parsed. */
  missingColumns: string[];
}

/** Response body of `POST /api/media/import`. */
export interface MediaImportResult {
  inserted: number;
  duplicates: CsvRowIssue[];
  rejected: CsvRowIssue[];
}

const REQUIRED_COLUMNS = ["title", "media_type"] as const;
const SMALLINT_MIN = -32768;
const SMALLINT_MAX = 32767;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Integer columns are Postgres smallint. A value that is not a whole number in range
// would fail the whole multi-row INSERT, so it rejects just its own row instead.
function parseSmallInt(
  raw: string | undefined,
  column: string,
  errors: string[],
  min = SMALLINT_MIN,
): number | null {
  const v = raw?.trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > SMALLINT_MAX) {
    errors.push(`${column} must be a whole number (got "${v}")`);
    return null;
  }
  return n;
}

function parseIsoDate(raw: string | undefined, column: string, errors: string[]): string | null {
  const v = raw?.trim();
  if (!v) return null;
  // Round-trip through Date so impossible dates like 2026-02-30 are caught too.
  const valid = ISO_DATE.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
  if (!valid) {
    errors.push(`${column} must be a date like 2026-01-31 (got "${v}")`);
    return null;
  }
  return v;
}

// Spreadsheets save booleans as TRUE/FALSE; CentOS writes true/false.
const isTruthy = (v: string | undefined) => /^(true|1|yes)$/i.test(v?.trim() ?? "");

/** `Media Type` / ` media_type ` → `media_type`, so older Title Case exports still map. */
const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, "_");

/**
 * Parse a CSV file into validated MediaItemInputs. Accepts Stream.WitUS exports and
 * CentenarianOS exports/templates (which add `season_number`, `episode_number` and a
 * `favorite` alias of `is_favorite`). Rows that cannot be imported come back in
 * `rejected` with a reason; bad optional values that are safe to drop (rating out of
 * range, unknown status/visibility) fall back to defaults as before.
 */
export function csvToMediaItems(text: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });

  const fields = parsed.meta.fields ?? [];
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !fields.includes(c));
  if (missingColumns.length > 0) return { rows: [], rejected: [], missingColumns };

  const rows: ParsedCsvRow[] = [];
  const rejected: CsvRowIssue[] = [];

  for (const [index, r] of parsed.data.entries()) {
    const row = index + 2;
    const title = r.title?.trim() || null;
    const mediaType = r.media_type?.trim().toLowerCase() ?? "";

    if (!title) {
      rejected.push({ row, title, reason: "Missing title" });
      continue;
    }
    if (!isMediaType(mediaType)) {
      const reason = mediaType
        ? `Unknown media_type "${mediaType}" (use one of: ${MEDIA_TYPES.join(", ")})`
        : "Missing media_type";
      rejected.push({ row, title, reason });
      continue;
    }

    const errors: string[] = [];
    const yearReleased = parseSmallInt(r.year_released, "year_released", errors);
    const seasonNumber = parseSmallInt(r.season_number, "season_number", errors, 0);
    const episodeNumber = parseSmallInt(r.episode_number, "episode_number", errors, 0);
    const startDate = parseIsoDate(r.start_date, "start_date", errors);
    const endDate = parseIsoDate(r.end_date, "end_date", errors);
    if (errors.length > 0) {
      rejected.push({ row, title, reason: errors.join("; ") });
      continue;
    }

    const status = r.status?.trim();
    const visibility = r.visibility?.trim();
    const ratingNum = Number(r.rating);
    rows.push({
      row,
      item: {
        title,
        mediaType,
        creator: r.creator || null,
        status: status && isStatus(status) ? status : "want_to_consume",
        rating: Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : null,
        genre: toStringArray(r.genre),
        tags: toStringArray(r.tags),
        coverImageUrl: r.cover_image_url || null,
        externalUrl: r.external_url || null,
        startDate,
        endDate,
        yearReleased,
        sourcePlatform: r.source_platform || null,
        currentProgress: r.current_progress || null,
        totalLength: r.total_length || null,
        seasonNumber,
        episodeNumber,
        visibility: visibility && isVisibility(visibility) ? visibility : "private",
        isFavorite: isTruthy(r.is_favorite ?? r.favorite),
        notes: r.notes || null,
      },
    });
  }

  return { rows, rejected, missingColumns: [] };
}

/**
 * Identity used to spot a duplicate import: same title (trimmed, case-insensitive),
 * same media type, same release year (a missing year only matches a missing year).
 */
export function mediaDedupeKey(item: {
  title: string;
  mediaType: string;
  yearReleased?: number | null;
}): string {
  return [item.title.trim().toLowerCase(), item.mediaType, item.yearReleased ?? ""].join("\u0000");
}

/**
 * Split parsed rows into the ones to insert and the ones to skip: rows matching an item
 * the user already has (`existingKeys`, built with mediaDedupeKey) and later repeats of a
 * row earlier in the same file. The first occurrence in the file wins.
 */
export function splitDuplicates(
  rows: ParsedCsvRow[],
  existingKeys: ReadonlySet<string>,
): { unique: ParsedCsvRow[]; duplicates: CsvRowIssue[] } {
  const unique: ParsedCsvRow[] = [];
  const duplicates: CsvRowIssue[] = [];
  const seenInFile = new Map<string, number>();
  for (const r of rows) {
    const key = mediaDedupeKey(r.item);
    const title = r.item.title;
    if (existingKeys.has(key)) {
      duplicates.push({ row: r.row, title, reason: "Already in your library" });
      continue;
    }
    const firstRow = seenInFile.get(key);
    if (firstRow !== undefined) {
      duplicates.push({ row: r.row, title, reason: `Same as row ${firstRow} in this file` });
      continue;
    }
    seenInFile.set(key, r.row);
    unique.push(r);
  }
  return { unique, duplicates };
}
