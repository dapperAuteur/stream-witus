import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  csvToMediaItems,
  itemsToCsv,
  mediaDedupeKey,
  type ParsedCsvRow,
  splitDuplicates,
} from "@/lib/csv";

// Pure parser + duplicate-rule tests (no DB).
//
// CENTOS_EXPORT_HEADERS is copied from the header array in CentenarianOS's
// app/api/media/export/route.ts (2026-09-21). The drift check at the bottom re-reads
// that file when the sibling repo is checked out next to this one, and skips otherwise.
const CENTOS_EXPORT_HEADERS = [
  "title", "creator", "media_type", "status", "rating",
  "start_date", "end_date", "genre", "tags",
  "cover_image_url", "external_url",
  "current_progress", "total_length",
  "season_number", "episode_number", "year_released",
  "source_platform", "notes", "favorite", "visibility",
  "is_favorite",
];

type CentosRow = Partial<Record<(typeof CENTOS_EXPORT_HEADERS)[number], string>>;

// Mirrors CentOS lib/csv/helpers.ts (csvEscape + buildCsvResponse): quote a cell only
// when it holds a comma, quote or newline; rows joined with "\n".
function centosCsv(rows: CentosRow[], headers: string[] = CENTOS_EXPORT_HEADERS): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(","));
  return [headers.join(","), ...lines].join("\n");
}

// A row the way the CentOS export route writes it: empty strings for nulls,
// `favorite` and `is_favorite` both carrying the same flag.
function centosRow(fields: CentosRow & { title: string; media_type: string }): CentosRow {
  const fav = fields.favorite ?? "false";
  return { status: "want_to_consume", visibility: "private", favorite: fav, is_favorite: fav, ...fields };
}

describe("csvToMediaItems with a CentenarianOS export", () => {
  const csv = centosCsv([
    centosRow({
      title: "Fake Show", creator: "Fake Studio", media_type: "tv_show", status: "in_progress",
      rating: "3", genre: "Drama", start_date: "2026-08-01", year_released: "2021",
      source_platform: "FakeFlix", current_progress: "S1E1", total_length: "3 episodes",
      season_number: "2", episode_number: "7",
      notes: 'Has a comma, a "quote" and\na second line.',
    }),
    centosRow({
      title: "Fake Book", creator: "A. Author", media_type: "book", status: "completed",
      rating: "5", genre: "Nonfiction;Health", tags: "longevity", start_date: "2026-01-02",
      end_date: "2026-02-03", visibility: "public", favorite: "true",
    }),
    centosRow({ title: "Fake Podcast", media_type: "podcast", status: "in_progress" }),
  ]);

  const result = csvToMediaItems(csv);

  it("parses every row with nothing rejected", () => {
    expect(result.missingColumns).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.rows.map((r) => r.row)).toEqual([2, 3, 4]);
  });

  it("maps season_number and episode_number into seasonNumber / episodeNumber", () => {
    const show = result.rows[0].item;
    expect(show.seasonNumber).toBe(2);
    expect(show.episodeNumber).toBe(7);
    expect(result.rows[1].item.seasonNumber).toBeNull();
    expect(result.rows[1].item.episodeNumber).toBeNull();
  });

  it("keeps the other CentOS fields", () => {
    const show = result.rows[0].item;
    expect(show).toMatchObject({
      title: "Fake Show",
      creator: "Fake Studio",
      mediaType: "tv_show",
      status: "in_progress",
      rating: 3,
      genre: ["Drama"],
      startDate: "2026-08-01",
      endDate: null,
      yearReleased: 2021,
      sourcePlatform: "FakeFlix",
      currentProgress: "S1E1",
      totalLength: "3 episodes",
      visibility: "private",
      isFavorite: false,
      notes: 'Has a comma, a "quote" and\na second line.',
    });
    const book = result.rows[1].item;
    expect(book).toMatchObject({
      genre: ["Nonfiction", "Health"],
      tags: ["longevity"],
      endDate: "2026-02-03",
      visibility: "public",
      isFavorite: true,
    });
  });

  it("reads the favorite flag from `favorite` when `is_favorite` is absent (CentOS template)", () => {
    const headers = CENTOS_EXPORT_HEADERS.filter((h) => h !== "is_favorite");
    const { rows } = csvToMediaItems(
      centosCsv([{ title: "Liked", media_type: "movie", favorite: "true" }], headers),
    );
    expect(rows[0].item.isFavorite).toBe(true);
  });

  it("accepts spreadsheet-style TRUE and Title Case headers", () => {
    const csv2 = "Title,Media Type,Is Favorite,Year Released\nOld Export,Movie,TRUE,1999";
    const { rows, rejected } = csvToMediaItems(csv2);
    expect(rejected).toEqual([]);
    expect(rows[0].item).toMatchObject({ title: "Old Export", mediaType: "movie", isFavorite: true, yearReleased: 1999 });
  });
});

describe("csvToMediaItems rejections", () => {
  it("rejects rows it cannot import, with the reason and spreadsheet row number", () => {
    const csv = centosCsv([
      centosRow({ title: "Good", media_type: "book" }),
      centosRow({ title: "", media_type: "book" }),
      centosRow({ title: "No Type", media_type: "" }),
      centosRow({ title: "Wrong Type", media_type: "vinyl" }),
      centosRow({ title: "Bad Year", media_type: "movie", year_released: "nineteen" }),
      centosRow({ title: "Bad Date", media_type: "movie", start_date: "2026-02-30" }),
      centosRow({ title: "Bad Episode", media_type: "tv_show", season_number: "1.5", episode_number: "-2" }),
    ]);
    const { rows, rejected } = csvToMediaItems(csv);

    expect(rows.map((r) => r.item.title)).toEqual(["Good"]);
    expect(rejected).toHaveLength(6);
    expect(rejected[0]).toEqual({ row: 3, title: null, reason: "Missing title" });
    expect(rejected[1]).toEqual({ row: 4, title: "No Type", reason: "Missing media_type" });
    expect(rejected[2].reason).toMatch(/^Unknown media_type "vinyl"/);
    expect(rejected[3].reason).toBe('year_released must be a whole number (got "nineteen")');
    expect(rejected[4].reason).toBe('start_date must be a date like 2026-01-31 (got "2026-02-30")');
    expect(rejected[5]).toMatchObject({ row: 8, title: "Bad Episode" });
    expect(rejected[5].reason).toContain("season_number");
    expect(rejected[5].reason).toContain("episode_number");
  });

  it("drops an unusable rating instead of rejecting the row", () => {
    const csv = centosCsv([
      centosRow({ title: "Too High", media_type: "book", rating: "9" }),
      centosRow({ title: "Half Star", media_type: "book", rating: "4.5" }),
    ]);
    const { rows, rejected } = csvToMediaItems(csv);
    expect(rejected).toEqual([]);
    expect(rows.map((r) => r.item.rating)).toEqual([null, null]);
  });

  it("reports missing required columns instead of rejecting every row", () => {
    const result = csvToMediaItems("name,kind\nDune,book");
    expect(result.missingColumns).toEqual(["title", "media_type"]);
    expect(result.rows).toEqual([]);
    expect(result.rejected).toEqual([]);
  });
});

describe("Stream.WitUS export round-trip", () => {
  it("re-imports season and episode from its own export", () => {
    const csv = itemsToCsv([
      { title: "Round Trip", mediaType: "tv_show", seasonNumber: 4, episodeNumber: 10, genre: ["a", "b"], isFavorite: true },
    ]);
    const { rows, rejected } = csvToMediaItems(csv);
    expect(rejected).toEqual([]);
    expect(rows[0].item).toMatchObject({ seasonNumber: 4, episodeNumber: 10, genre: ["a", "b"], isFavorite: true });
  });
});

describe("duplicate rule", () => {
  const parsed = (row: number, title: string, mediaType: "book" | "movie" | "tv_show", yearReleased: number | null = null): ParsedCsvRow => ({
    row,
    item: { title, mediaType, yearReleased },
  });

  it("matches title case-insensitively and ignores surrounding spaces", () => {
    expect(mediaDedupeKey({ title: "  The Wire ", mediaType: "tv_show", yearReleased: 2002 })).toBe(
      mediaDedupeKey({ title: "the wire", mediaType: "tv_show", yearReleased: 2002 }),
    );
  });

  it("treats a different media type or year as a different item", () => {
    const base = mediaDedupeKey({ title: "Dune", mediaType: "book", yearReleased: 1965 });
    expect(mediaDedupeKey({ title: "Dune", mediaType: "movie", yearReleased: 1965 })).not.toBe(base);
    expect(mediaDedupeKey({ title: "Dune", mediaType: "book", yearReleased: 2021 })).not.toBe(base);
    expect(mediaDedupeKey({ title: "Dune", mediaType: "book", yearReleased: null })).not.toBe(base);
  });

  it("skips rows already in the library and repeats within the file", () => {
    const existing = new Set([mediaDedupeKey({ title: "Dune", mediaType: "book", yearReleased: 1965 })]);
    const { unique, duplicates } = splitDuplicates(
      [
        parsed(2, "DUNE", "book", 1965),
        parsed(3, "Dune", "movie", 2021),
        parsed(4, "Arrival", "movie", 2016),
        parsed(5, " arrival ", "movie", 2016),
        parsed(6, "Arrival", "movie", null),
      ],
      existing,
    );
    expect(unique.map((r) => r.row)).toEqual([3, 4, 6]);
    expect(duplicates).toEqual([
      { row: 2, title: "DUNE", reason: "Already in your library" },
      { row: 5, title: " arrival ", reason: "Same as row 4 in this file" },
    ]);
  });

  it("is safe to run twice: the second import of the same file inserts nothing", () => {
    const csv = centosCsv([
      centosRow({ title: "Fake Show", media_type: "tv_show", year_released: "2021", season_number: "1" }),
      centosRow({ title: "Fake Book", media_type: "book" }),
    ]);
    const first = splitDuplicates(csvToMediaItems(csv).rows, new Set());
    expect(first.unique).toHaveLength(2);

    const library = new Set(first.unique.map((r) => mediaDedupeKey(r.item)));
    const second = splitDuplicates(csvToMediaItems(csv).rows, library);
    expect(second.unique).toEqual([]);
    expect(second.duplicates.map((d) => d.reason)).toEqual(["Already in your library", "Already in your library"]);
  });
});

const CENTOS_ROUTE = join(process.cwd(), "../../gemini/centenarian-os/app/api/media/export/route.ts");

describe.skipIf(!existsSync(CENTOS_ROUTE))("CentOS export header drift check", () => {
  it("the fixture headers still match CentOS's export route", () => {
    const src = readFileSync(CENTOS_ROUTE, "utf8");
    const block = src.match(/buildCsvResponse\(\s*\[([\s\S]*?)\],/);
    expect(block).not.toBeNull();
    const headers = [...(block?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(headers).toEqual(CENTOS_EXPORT_HEADERS);
  });
});
