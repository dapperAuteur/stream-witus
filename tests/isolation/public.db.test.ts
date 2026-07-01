import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ScopedDb } from "../../src/db/scoped";
import { getPublicEpisode, listOwnerPublicMedia, listPublicEpisodes } from "../../src/db/public";
import {
  cleanupOwners,
  closeTestDb,
  getTestDb,
  hasTestDb,
  type SeededOwners,
  seedTwoOwners,
  type TestDb,
} from "./fixtures";

// Phase 5 gate: the public read path must ONLY ever surface visibility=public
// rows. A private episode (any owner) must never leak to a logged-out reader.
describe.skipIf(!hasTestDb)("public episode read path", () => {
  let db: TestDb;
  let owners: SeededOwners;
  let epId: string;

  beforeAll(async () => {
    db = getTestDb();
    owners = await seedTwoOwners(db);
    const a = new ScopedDb(owners.ownerA, db);
    const ep = await a.createEpisode({ title: "A's episode", status: "published" });
    epId = ep.id;
  });

  afterAll(async () => {
    if (owners) await cleanupOwners(db, owners);
    await closeTestDb();
  });

  it("a private (default) episode is not exposed publicly", async () => {
    expect(await getPublicEpisode(epId, db)).toBeNull();
    const list = await listPublicEpisodes(db);
    expect(list.find((e) => e.id === epId)).toBeUndefined();
  });

  it("once made public it is exposed; other private episodes stay hidden", async () => {
    const a = new ScopedDb(owners.ownerA, db);
    await a.updateEpisode(epId, { visibility: "public" });
    expect((await getPublicEpisode(epId, db))?.id).toBe(epId);

    const draft = await a.createEpisode({ title: "A's draft", status: "published" });
    const list = await listPublicEpisodes(db);
    expect(list.find((e) => e.id === epId)).toBeDefined();
    expect(list.find((e) => e.id === draft.id)).toBeUndefined();
  });
});

// Phase 8: the public shelf must only ever surface the owner's PUBLIC items —
// never a private item, never another owner's item.
describe.skipIf(!hasTestDb)("public shelf (owner public media)", () => {
  let db: TestDb;
  let owners: SeededOwners;
  let aPublic: string;
  let aPrivate: string;
  let bPublic: string;

  beforeAll(async () => {
    db = getTestDb();
    owners = await seedTwoOwners(db);
    const a = new ScopedDb(owners.ownerA, db);
    const b = new ScopedDb(owners.ownerB, db);
    aPublic = (await a.createMediaItem({ title: "A public", mediaType: "book", visibility: "public" })).id;
    aPrivate = (await a.createMediaItem({ title: "A private", mediaType: "book", visibility: "private" })).id;
    bPublic = (await b.createMediaItem({ title: "B public", mediaType: "book", visibility: "public" })).id;
  });

  afterAll(async () => {
    if (owners) await cleanupOwners(db, owners);
    await closeTestDb();
  });

  it("returns the owner's public items only — not their private ones", async () => {
    const shelf = await listOwnerPublicMedia(owners.ownerA, db);
    expect(shelf.find((i) => i.id === aPublic)).toBeDefined();
    expect(shelf.find((i) => i.id === aPrivate)).toBeUndefined();
  });

  it("never includes another owner's items", async () => {
    const shelf = await listOwnerPublicMedia(owners.ownerA, db);
    expect(shelf.find((i) => i.id === bPublic)).toBeUndefined();
  });
});
