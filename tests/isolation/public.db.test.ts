import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ScopedDb } from "../../src/db/scoped";
import { getPublicEpisode, listPublicEpisodes } from "../../src/db/public";
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
