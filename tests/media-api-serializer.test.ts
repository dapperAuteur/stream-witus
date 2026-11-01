import { getTableColumns, type Table } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { mediaCategories, mediaCreators, mediaItems, mediaPlatforms } from "@/db/schema/media";
import { mediaNotes } from "@/db/schema/notes";
import { mediaEpisodeLinks, podcastEpisodes } from "@/db/schema/podcast";
import {
  EPISODE_LINK_PRIVATE_COLUMNS,
  EPISODE_PRIVATE_COLUMNS,
  MEDIA_CATEGORY_PRIVATE_COLUMNS,
  MEDIA_ITEM_PRIVATE_COLUMNS,
  MEDIA_NOTE_PRIVATE_COLUMNS,
  mediaTypeLabel,
  NAMED_COUNT_PRIVATE_COLUMNS,
  toApiEpisode,
  toApiEpisodeLink,
  toApiMediaCategory,
  toApiMediaItem,
  toApiMediaNote,
  toApiNamedCount,
} from "@/lib/media-api";

// The API speaks snake_case; ScopedDb hands back camelCase Drizzle rows. Each
// serializer must map EVERY column of its table (bar the private ones) to the
// column's snake_case database name, so adding a column without updating the
// serializer fails here instead of rendering `undefined` in the dashboard.

/** A row with a distinct, type-appropriate value in every column. */
function sampleRow(table: Table): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  Object.entries(getTableColumns(table)).forEach(([key, col], i) => {
    if (col.dataType === "date") row[key] = new Date(Date.UTC(2026, 9, 1 + i));
    else if (col.dataType === "number") row[key] = i + 1;
    else if (col.dataType === "boolean") row[key] = true;
    else if (col.dataType === "array") row[key] = [`${key}-a`, `${key}-b`];
    else row[key] = `${key}-value`;
  });
  return row;
}

const CASES = [
  { name: "toApiMediaItem", table: mediaItems, fn: toApiMediaItem, hidden: MEDIA_ITEM_PRIVATE_COLUMNS },
  { name: "toApiMediaNote", table: mediaNotes, fn: toApiMediaNote, hidden: MEDIA_NOTE_PRIVATE_COLUMNS },
  { name: "toApiMediaCategory", table: mediaCategories, fn: toApiMediaCategory, hidden: MEDIA_CATEGORY_PRIVATE_COLUMNS },
  { name: "toApiNamedCount (creators)", table: mediaCreators, fn: toApiNamedCount, hidden: NAMED_COUNT_PRIVATE_COLUMNS },
  { name: "toApiNamedCount (platforms)", table: mediaPlatforms, fn: toApiNamedCount, hidden: NAMED_COUNT_PRIVATE_COLUMNS },
  { name: "toApiEpisode", table: podcastEpisodes, fn: toApiEpisode, hidden: EPISODE_PRIVATE_COLUMNS },
  { name: "toApiEpisodeLink", table: mediaEpisodeLinks, fn: toApiEpisodeLink, hidden: EPISODE_LINK_PRIVATE_COLUMNS },
] as const;

describe.each(CASES)("$name", ({ table, fn, hidden }) => {
  const columns = Object.entries(getTableColumns(table));
  const row = sampleRow(table);
  const out = (fn as unknown as (r: unknown) => Record<string, unknown>)(row);

  it("maps every public column to its snake_case name with the row's value", () => {
    for (const [key, col] of columns) {
      if ((hidden as readonly string[]).includes(key)) continue;
      const v = row[key];
      expect(out, `${key} → ${col.name}`).toHaveProperty(col.name, v instanceof Date ? v.toISOString() : v);
    }
  });

  it("emits only snake_case column names and leaves out the private columns", () => {
    const publicNames = columns
      .filter(([key]) => !(hidden as readonly string[]).includes(key))
      .map(([, col]) => col.name)
      .sort();
    expect(Object.keys(out).sort()).toEqual(publicNames);
    for (const key of Object.keys(out)) expect(key).toMatch(/^[a-z0-9_]+$/);
  });
});

describe("toApiMediaItem", () => {
  it("turns null genre and tags into empty arrays", () => {
    const row = { ...sampleRow(mediaItems), genre: null, tags: null };
    const out = toApiMediaItem(row as unknown as typeof mediaItems.$inferSelect);
    expect(out.genre).toEqual([]);
    expect(out.tags).toEqual([]);
  });

  it("passes string timestamps through unchanged", () => {
    const row = { ...sampleRow(mediaItems), createdAt: "2026-10-31T00:00:00.000Z" };
    const out = toApiMediaItem(row as unknown as typeof mediaItems.$inferSelect);
    expect(out.created_at).toBe("2026-10-31T00:00:00.000Z");
  });
});

describe("mediaTypeLabel", () => {
  it("replaces every underscore", () => expect(mediaTypeLabel("tv_show")).toBe("tv show"));
  it("returns an empty label instead of throwing on a missing type", () => {
    expect(mediaTypeLabel(undefined)).toBe("");
    expect(mediaTypeLabel(null)).toBe("");
  });
});
