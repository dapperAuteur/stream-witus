import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ScopedDb } from "../../src/db/scoped";
import {
  cleanupOwners,
  closeTestDb,
  getTestDb,
  hasTestDb,
  type SeededOwners,
  seedTwoOwners,
  type TestDb,
} from "./fixtures";

// The Phase 2 HARD GATE. Proves the owner-scoped chokepoint never leaks across
// owners. Requires a migrated Neon DB (operator task 02 + `pnpm db:migrate`); it
// skips cleanly until then, so `pnpm test` is green before the DB exists and
// becomes a real gate the moment it does.
describe.skipIf(!hasTestDb)("owner isolation (ScopedDb)", () => {
  let db: TestDb;
  let owners: SeededOwners;
  let aItemId: string;

  beforeAll(async () => {
    db = getTestDb();
    owners = await seedTwoOwners(db);
    const a = new ScopedDb(owners.ownerA, db);
    const item = await a.createMediaItem({ title: "A's secret book", mediaType: "book" });
    aItemId = item.id;
  });

  afterAll(async () => {
    if (owners) await cleanupOwners(db, owners);
    await closeTestDb();
  });

  it("B's list never includes A's items", async () => {
    const b = new ScopedDb(owners.ownerB, db);
    const { items } = await b.listMediaItems();
    expect(items.find((i) => i.id === aItemId)).toBeUndefined();
  });

  it("B reading A's item by id returns null (caller 404s — no cross-owner row)", async () => {
    const b = new ScopedDb(owners.ownerB, db);
    expect(await b.getMediaItem(aItemId)).toBeNull();
  });

  it("B cannot patch A's item", async () => {
    const b = new ScopedDb(owners.ownerB, db);
    expect(await b.updateMediaItem(aItemId, { title: "hijacked" })).toBeNull();
    // A's item is untouched.
    const a = new ScopedDb(owners.ownerA, db);
    expect((await a.getMediaItem(aItemId))?.title).toBe("A's secret book");
  });

  it("B cannot soft-delete A's item", async () => {
    const b = new ScopedDb(owners.ownerB, db);
    expect(await b.softDeleteMediaItem(aItemId)).toBe(false);
    const a = new ScopedDb(owners.ownerA, db);
    expect((await a.getMediaItem(aItemId))?.isActive).toBe(true);
  });

  it("B cannot attach a note to A's item", async () => {
    const b = new ScopedDb(owners.ownerB, db);
    expect(await b.createNote(aItemId, { content: "leak" })).toBeNull();
  });

  it("B cannot create a relationship pointing at A's item", async () => {
    const b = new ScopedDb(owners.ownerB, db);
    const bItem = await b.createMediaItem({ title: "B's movie", mediaType: "movie" });
    const rel = await b.createRelationship({
      parentId: bItem.id,
      childId: aItemId,
      relationshipType: "adaptation_of",
    });
    expect(rel).toBeNull();
  });

  it("A retains full access to its own item", async () => {
    const a = new ScopedDb(owners.ownerA, db);
    expect(await a.getMediaItem(aItemId)).not.toBeNull();
    const { items } = await a.listMediaItems();
    expect(items.find((i) => i.id === aItemId)).toBeDefined();
  });
});
