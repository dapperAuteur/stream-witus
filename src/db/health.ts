import "server-only";
import { sql } from "drizzle-orm";
import { db as defaultDb } from "./client";

type Db = typeof defaultDb;

/**
 * Cheapest possible liveness query against Neon: no tables, no rows, no user data,
 * so it can never leak owner-scoped content and never needs a session. It exists so
 * `/api/health` proves the app can actually reach its database, rather than
 * answering from a cached render while Postgres is down.
 *
 * Throws on any failure. The caller must swallow the error without reading it:
 * driver errors can embed the connection string.
 */
export async function pingDatabase(db: Db = defaultDb): Promise<void> {
  await db.execute(sql`select 1`);
}
