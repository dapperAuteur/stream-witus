import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The media handlers against a mocked ScopedDb (no database). ScopedDb returns raw
// camelCase Drizzle rows; the UI reads snake_case. Before the fix GET /api/media sent
// `mediaType`, MediaCard called `item.media_type.replace(...)` on undefined, and the
// Media page crashed right after BAM's first CSV import.

const ROW = {
  id: "8f6c1d2e-0000-4000-8000-000000000001",
  userId: "owner-1",
  title: "Behind Her Eyes",
  creator: "Sarah Pinborough",
  mediaType: "tv_show" as const,
  status: "completed" as const,
  rating: 4,
  startDate: "2021-02-17",
  endDate: "2021-02-20",
  genre: ["thriller"],
  tags: null,
  coverImageUrl: null,
  externalUrl: null,
  categoryId: null,
  currentProgress: null,
  totalLength: null,
  seasonNumber: 1,
  episodeNumber: 6,
  totalSeasons: 1,
  totalEpisodes: 6,
  visibility: "private" as const,
  yearReleased: 2021,
  sourcePlatform: "Netflix",
  notes: null,
  isFavorite: false,
  useCount: 0,
  isActive: true,
  shareOnFinish: false,
  externalSource: null,
  externalId: null,
  createdAt: new Date("2026-10-31T12:00:00Z"),
  updatedAt: new Date("2026-10-31T12:00:00Z"),
};

const NOTE = {
  id: "note-1",
  userId: "owner-1",
  mediaItemId: ROW.id,
  title: null,
  content: "Twist ending",
  contentFormat: "markdown" as const,
  noteType: "spoiler" as const,
  audioUrl: null,
  audioPublicId: null,
  isPublic: false,
  sortOrder: 0,
  createdAt: new Date("2026-10-31T12:00:00Z"),
  updatedAt: new Date("2026-10-31T12:00:00Z"),
};

const EPISODE = {
  id: "ep-1",
  userId: "owner-1",
  showId: null,
  title: "Episode 1",
  episodeNumber: 1,
  seasonNumber: 2,
  airDate: "2026-10-01",
  description: null,
  showNotes: null,
  showNotesFormat: "markdown" as const,
  audioUrl: null,
  audioLengthBytes: null,
  audioMime: null,
  externalUrl: null,
  durationMin: 42,
  status: "draft" as const,
  visibility: "private" as const,
  isActive: true,
  artworkUrl: null,
  showNotesExcerpt: null,
  publishedAt: null,
  disctopiaGuid: null,
  createdAt: new Date("2026-10-31T12:00:00Z"),
  updatedAt: new Date("2026-10-31T12:00:00Z"),
};

const sdb = {
  userId: "owner-1",
  listMediaItems: vi.fn(),
  getMediaItem: vi.fn(),
  createMediaItem: vi.fn(),
  updateMediaItem: vi.fn(),
  listNotes: vi.fn(),
  createNote: vi.fn(),
  listCreators: vi.fn(),
  listEpisodes: vi.fn(),
  getEpisode: vi.fn(),
};

vi.mock("@/db/scoped", () => ({ getScopedDb: async () => sdb }));
vi.mock("@/lib/outbox-trigger", () => ({ fireMediaFinished: vi.fn(), fireEpisodePublished: vi.fn() }));

const mediaList = await import("@/app/api/media/route");
const mediaDetail = await import("@/app/api/media/[id]/route");
const mediaNotes = await import("@/app/api/media/[id]/notes/route");
const creators = await import("@/app/api/media/creators/route");
const podcasts = await import("@/app/api/podcasts/route");
const podcastDetail = await import("@/app/api/podcasts/[id]/route");

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (path: string, init?: { method: string; body: unknown }) =>
  new NextRequest(`http://localhost${path}`, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: init ? JSON.stringify(init.body) : undefined,
  });

/** No camelCase key may reach the client: `mediaType` would mean the bug is back. */
function expectSnakeKeys(obj: Record<string, unknown>) {
  for (const key of Object.keys(obj)) expect(key).toMatch(/^[a-z0-9_]+$/);
}

beforeEach(() => {
  sdb.listMediaItems.mockReset().mockResolvedValue({ items: [ROW], total: 1 });
  sdb.getMediaItem.mockReset().mockResolvedValue(ROW);
  sdb.createMediaItem.mockReset().mockResolvedValue(ROW);
  sdb.updateMediaItem.mockReset().mockResolvedValue({ ...ROW, rating: 5 });
  sdb.listNotes.mockReset().mockResolvedValue([NOTE]);
  sdb.createNote.mockReset().mockResolvedValue(NOTE);
  sdb.listCreators.mockReset().mockResolvedValue([
    { id: "c1", userId: "owner-1", name: "Sarah Pinborough", useCount: 3, createdAt: new Date("2026-10-31T12:00:00Z") },
  ]);
  sdb.listEpisodes.mockReset().mockResolvedValue([EPISODE]);
  sdb.getEpisode.mockReset().mockResolvedValue(EPISODE);
});

describe("GET /api/media", () => {
  it("returns items with media_type (what MediaCard reads), not mediaType", async () => {
    const res = await mediaList.GET(req("/api/media"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    const [item] = body.items;
    expect(item).toMatchObject({
      id: ROW.id,
      title: "Behind Her Eyes",
      media_type: "tv_show",
      start_date: "2021-02-17",
      year_released: 2021,
      source_platform: "Netflix",
      is_favorite: false,
      season_number: 1,
      genre: ["thriller"],
      tags: [],
      created_at: "2026-10-31T12:00:00.000Z",
    });
    expectSnakeKeys(item);
    expect(item).not.toHaveProperty("user_id");
  });
});

describe("POST /api/media", () => {
  it("returns the created item in snake_case (MediaForm reads data.item.media_type)", async () => {
    const res = await mediaList.POST(
      req("/api/media", { method: "POST", body: { title: "Behind Her Eyes", media_type: "tv_show" } }),
    );
    expect(res.status).toBe(201);
    const { item } = await res.json();
    expect(item.media_type).toBe("tv_show");
    expectSnakeKeys(item);
  });
});

describe("GET and PATCH /api/media/[id]", () => {
  it("GET returns a snake_case item", async () => {
    const res = await mediaDetail.GET(req(`/api/media/${ROW.id}`), params(ROW.id));
    const { item } = await res.json();
    expect(item.media_type).toBe("tv_show");
    expectSnakeKeys(item);
  });

  it("PATCH returns the updated item in snake_case", async () => {
    const res = await mediaDetail.PATCH(
      req(`/api/media/${ROW.id}`, { method: "PATCH", body: { rating: 5 } }),
      params(ROW.id),
    );
    const { item } = await res.json();
    expect(item).toMatchObject({ media_type: "tv_show", rating: 5 });
    expectSnakeKeys(item);
  });
});

describe("notes, creators and podcasts", () => {
  it("GET /api/media/[id]/notes returns snake_case notes", async () => {
    const res = await mediaNotes.GET(req(`/api/media/${ROW.id}/notes`), params(ROW.id));
    const { notes } = await res.json();
    expect(notes[0]).toMatchObject({ note_type: "spoiler", content_format: "markdown", is_public: false });
    expectSnakeKeys(notes[0]);
  });

  it("POST /api/media/[id]/notes returns a snake_case note", async () => {
    const res = await mediaNotes.POST(
      req(`/api/media/${ROW.id}/notes`, { method: "POST", body: { content: "Twist ending" } }),
      params(ROW.id),
    );
    const { note } = await res.json();
    expect(note.note_type).toBe("spoiler");
    expectSnakeKeys(note);
  });

  it("GET /api/media/creators returns use_count (the settings page shows it)", async () => {
    const res = await creators.GET();
    const list = await res.json();
    expect(list[0]).toMatchObject({ name: "Sarah Pinborough", use_count: 3 });
    expectSnakeKeys(list[0]);
  });

  it("GET /api/podcasts and /api/podcasts/[id] return snake_case episodes", async () => {
    const { episodes } = await (await podcasts.GET()).json();
    expect(episodes[0]).toMatchObject({ episode_number: 1, season_number: 2, air_date: "2026-10-01", duration_min: 42 });
    expectSnakeKeys(episodes[0]);
    const { episode } = await (await podcastDetail.GET(req("/api/podcasts/ep-1"), params("ep-1"))).json();
    expect(episode.episode_number).toBe(1);
    expectSnakeKeys(episode);
  });
});
