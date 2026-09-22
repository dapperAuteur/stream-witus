import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaImportResult } from "@/lib/csv";

// POST /api/media/import against a mocked ScopedDb: no database is touched. Proves the
// route wires the duplicate rule to the owner's existing items and inserts only the
// rows that survive it.
const mocks = vi.hoisted(() => ({
  existing: [] as Array<{ title: string; mediaType: string; yearReleased: number | null }>,
  signedIn: true,
  listMediaIdentities: vi.fn(),
  importMediaItems: vi.fn(),
}));

vi.mock("@/db/scoped", () => ({
  getScopedDb: async () =>
    mocks.signedIn
      ? { listMediaIdentities: mocks.listMediaIdentities, importMediaItems: mocks.importMediaItems }
      : null,
}));

const { POST } = await import("@/app/api/media/import/route");

const HEADER = "title,media_type,year_released,season_number,episode_number,is_favorite";

function jsonRequest(csv: string) {
  return new NextRequest("http://localhost/api/media/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv }),
  });
}

beforeEach(() => {
  mocks.existing = [];
  mocks.signedIn = true;
  mocks.listMediaIdentities.mockReset().mockImplementation(async () => mocks.existing);
  mocks.importMediaItems
    .mockReset()
    .mockImplementation(async (rows: unknown[]) => ({ inserted: rows.length }));
});

describe("POST /api/media/import", () => {
  it("inserts new rows, skips duplicates and reports rejections", async () => {
    mocks.existing = [{ title: "Dune", mediaType: "book", yearReleased: 1965 }];
    const csv = [
      HEADER,
      " dune ,book,1965,,,false", // already in the library
      "Severance,tv_show,2022,2,4,true",
      "severance,tv_show,2022,2,5,false", // repeat of the row above
      "Mystery,vinyl,,,,false", // rejected
    ].join("\n");

    const res = await POST(jsonRequest(csv));
    expect(res.status).toBe(200);
    const body = (await res.json()) as MediaImportResult;

    expect(body.inserted).toBe(1);
    expect(body.duplicates).toEqual([
      { row: 2, title: "dune", reason: "Already in your library" },
      { row: 4, title: "severance", reason: "Same as row 3 in this file" },
    ]);
    expect(body.rejected).toHaveLength(1);
    expect(body.rejected[0]).toMatchObject({ row: 5, title: "Mystery" });

    expect(mocks.listMediaIdentities).toHaveBeenCalledWith(["book", "tv_show"]);
    const inserted = mocks.importMediaItems.mock.calls[0][0];
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ title: "Severance", seasonNumber: 2, episodeNumber: 4, isFavorite: true });
  });

  it("accepts a multipart file upload (what the import screen sends)", async () => {
    const form = new FormData();
    form.append("file", new File([`${HEADER}\nArrival,movie,2016,,,false`], "export.csv", { type: "text/csv" }));
    const res = await POST(new NextRequest("http://localhost/api/media/import", { method: "POST", body: form }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as MediaImportResult).inserted).toBe(1);
  });

  it("returns 200 with everything skipped when the file is imported a second time", async () => {
    mocks.existing = [{ title: "Arrival", mediaType: "movie", yearReleased: 2016 }];
    const res = await POST(jsonRequest(`${HEADER}\nArrival,movie,2016,,,false`));
    const body = (await res.json()) as MediaImportResult;
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ inserted: 0, rejected: [] });
    expect(body.duplicates).toHaveLength(1);
    expect(mocks.importMediaItems).toHaveBeenCalledWith([]);
  });

  it("rejects a file without the required header columns", async () => {
    const res = await POST(jsonRequest("name,kind\nDune,book"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no title or media_type column/);
    expect(mocks.importMediaItems).not.toHaveBeenCalled();
  });

  it("rejects an empty file and a file over the row limit", async () => {
    expect((await POST(jsonRequest(HEADER))).status).toBe(400);
    const big = [HEADER, ...Array.from({ length: 501 }, (_, i) => `Item ${i},book,,,,false`)].join("\n");
    expect((await POST(jsonRequest(big))).status).toBe(400);
    expect(mocks.importMediaItems).not.toHaveBeenCalled();
  });

  it("returns 401 when signed out", async () => {
    mocks.signedIn = false;
    expect((await POST(jsonRequest(HEADER))).status).toBe(401);
  });
});
