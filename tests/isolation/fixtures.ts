import { randomUUID } from "node:crypto";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { resolveDbUrl } from "../../scripts/db-url";
import * as schema from "../../src/db/schema";

neonConfig.webSocketConstructor = ws;

const connectionString = resolveDbUrl(true);

/** True when a real Neon DB is reachable — the DB-integration suite skips otherwise. */
export const hasTestDb = Boolean(connectionString && !connectionString.includes("placeholder"));

export type TestDb = NeonDatabase<typeof schema>;

let pool: Pool | undefined;

export function getTestDb(): TestDb {
  if (!connectionString) throw new Error("No DB URL — guard with hasTestDb before calling.");
  pool ??= new Pool({ connectionString, max: 1 });
  return drizzle(pool, { schema, casing: "snake_case" });
}

export async function closeTestDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

/**
 * Two isolated owners (mirrors witus-learn's two-tenant fixtures, dialed to
 * owner-scoping). Each test run uses fresh random ids so reruns never collide;
 * deleting the users cascades away all their media data on cleanup.
 */
export interface SeededOwners {
  ownerA: string;
  ownerB: string;
}

export async function seedTwoOwners(db: TestDb): Promise<SeededOwners> {
  const ownerA = `test-A-${randomUUID()}`;
  const ownerB = `test-B-${randomUUID()}`;
  // better-auth normalises emails to lowercase on signup; mirror that so
  // case-insensitive lookups (e.g. club invite by email) behave like production.
  await db.insert(schema.users).values([
    { id: ownerA, email: `${ownerA}@example.test`.toLowerCase(), emailVerified: true },
    { id: ownerB, email: `${ownerB}@example.test`.toLowerCase(), emailVerified: true },
  ]);
  return { ownerA, ownerB };
}

export async function cleanupOwners(db: TestDb, owners: SeededOwners): Promise<void> {
  const { inArray } = await import("drizzle-orm");
  await db.delete(schema.users).where(inArray(schema.users.id, [owners.ownerA, owners.ownerB]));
}
