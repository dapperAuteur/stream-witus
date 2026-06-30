import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ClubScoped } from "../../src/db/clubs";
import { users } from "../../src/db/schema/auth";
import { clubs } from "../../src/db/schema/club";
import {
  cleanupOwners,
  closeTestDb,
  getTestDb,
  hasTestDb,
  type SeededOwners,
  seedTwoOwners,
  type TestDb,
} from "./fixtures";

// Phase 6 gate: progress-gated, spoiler-safe discussion + membership isolation.
// A = club owner/author, B = plain member, C = non-member.
describe.skipIf(!hasTestDb)("ReadWitUS club gating", () => {
  let db: TestDb;
  let owners: SeededOwners; // A, B
  let outsiderId: string; // C
  let clubId: string;
  let readId: string;
  let m0: string, m1: string;
  let postId: string;

  beforeAll(async () => {
    db = getTestDb();
    owners = await seedTwoOwners(db);
    outsiderId = `test-C-${randomUUID()}`;
    await db.insert(users).values({ id: outsiderId, email: `${outsiderId}@example.test`, emailVerified: true });

    const a = new ClubScoped(owners.ownerA, db);
    const club = await a.createClub({ name: "Spoiler Club", slug: `spoiler-${randomUUID().slice(0, 8)}` });
    clubId = club.id;
    await a.addMemberByEmail(clubId, `${owners.ownerB}@example.test`);
    const read = await a.createRead(clubId, { title: "The Big Book", status: "active" });
    readId = read!.id;
    m0 = (await a.createMilestone(clubId, readId, { label: "Ch. 1–5", sortOrder: 0 }))!.id;
    m1 = (await a.createMilestone(clubId, readId, { label: "Ch. 6–10", sortOrder: 1 }))!.id;
    await a.createMilestone(clubId, readId, { label: "Ch. 11–15", sortOrder: 2 });
    // A posts a spoiler tied to the 2nd milestone.
    postId = (await a.createPost(clubId, readId, { milestoneId: m1, isSpoiler: true, body: "The villain is the narrator!" }))!.id;
  });

  afterAll(async () => {
    if (owners) await cleanupOwners(db, owners);
    await db.delete(users).where(eq(users.id, outsiderId)).catch(() => {});
    await db.delete(clubs).where(eq(clubs.id, clubId)).catch(() => {});
    await closeTestDb();
  });

  it("a non-member cannot read the club or its discussion", async () => {
    const c = new ClubScoped(outsiderId, db);
    expect(await c.getClub(clubId)).toBeNull();
    expect(await c.myRole(clubId)).toBeNull();
    expect(await c.listDiscussion(clubId, readId)).toBeNull();
  });

  it("a member BELOW the milestone gets the post locked with NO body", async () => {
    const b = new ClubScoped(owners.ownerB, db);
    await b.setMyProgress(clubId, readId, m0); // reached only milestone 1 (order 0)
    const posts = (await b.listDiscussion(clubId, readId))!;
    const post = posts.find((p) => p.id === postId)!;
    expect(post.locked).toBe(true);
    expect(post.body).toBeNull(); // spoiler never crosses the wire
  });

  it("the same member AT the milestone sees the post body", async () => {
    const b = new ClubScoped(owners.ownerB, db);
    await b.setMyProgress(clubId, readId, m1); // reached milestone 2 (order 1)
    const posts = (await b.listDiscussion(clubId, readId))!;
    const post = posts.find((p) => p.id === postId)!;
    expect(post.locked).toBe(false);
    expect(post.body).toBe("The villain is the narrator!");
  });

  it("the author always sees their own gated post", async () => {
    const a = new ClubScoped(owners.ownerA, db);
    const posts = (await a.listDiscussion(clubId, readId))!;
    const post = posts.find((p) => p.id === postId)!;
    expect(post.locked).toBe(false);
    expect(post.body).not.toBeNull();
  });
});
