import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { isAllowedToSignIn, getUserFlags } from "../../src/lib/access";
import { setUserDeactivated, setUserRole } from "../../src/lib/admin-data";
import { canManageSettings, canManageUsers, canModerate, canView } from "../../src/lib/session";
import { users } from "../../src/db/schema/auth";
import { closeTestDb, getTestDb, hasTestDb } from "./fixtures";

// The admin capability ladder — pure, deterministic (no DB).
describe("admin capability ladder", () => {
  it("monitor: view only", () => {
    expect([canView("monitor"), canModerate("monitor"), canManageSettings("monitor"), canManageUsers("monitor")])
      .toEqual([true, false, false, false]);
  });
  it("moderator: + moderation", () => {
    expect([canView("moderator"), canModerate("moderator"), canManageSettings("moderator"), canManageUsers("moderator")])
      .toEqual([true, true, false, false]);
  });
  it("admin: everything but user management", () => {
    expect([canView("admin"), canModerate("admin"), canManageSettings("admin"), canManageUsers("admin")])
      .toEqual([true, true, true, false]);
  });
  it("owner: everything", () => {
    expect([canView("owner"), canModerate("owner"), canManageSettings("owner"), canManageUsers("owner")])
      .toEqual([true, true, true, true]);
  });
});

// Role + deactivation persistence, and the deactivated sign-in block.
describe.skipIf(!hasTestDb)("roles + deactivation", () => {
  const db = getTestDb();
  const id = `test-role-${randomUUID()}`;
  const email = `${id}@example.test`.toLowerCase();

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, id)).catch(() => {});
    await closeTestDb();
  });

  it("stores and reads an admin role", async () => {
    await db.insert(users).values({ id, email, emailVerified: true });
    await setUserRole(id, "moderator");
    expect((await getUserFlags(id)).adminRole).toBe("moderator");
  });

  it("an existing member may sign in — until deactivated", async () => {
    expect(await isAllowedToSignIn(email)).toBe(true);
    await setUserDeactivated(id, true);
    expect(await isAllowedToSignIn(email)).toBe(false);
    expect((await getUserFlags(id)).deactivated).toBe(true);
    await setUserDeactivated(id, false);
    expect(await isAllowedToSignIn(email)).toBe(true);
  });
});
