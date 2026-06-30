import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Neon's websocket driver needs a Node WebSocket implementation.
neonConfig.webSocketConstructor = ws;

type Db = NeonDatabase<typeof schema>;

let cachedPool: Pool | undefined;
let cachedDb: Db | undefined;

function createDb(): Db {
  // One connection per serverless instance; Vercel scales by instance count.
  cachedPool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
  return drizzle(cachedPool, { schema, casing: "snake_case" });
}

// Lazy so importing the client never opens a connection at module load (keeps
// `next build` / typecheck free of a live DB). The Proxy instantiates on first use.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    cachedDb ??= createDb();
    return Reflect.get(cachedDb, prop, receiver);
  },
});

export { schema };
