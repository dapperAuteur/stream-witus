import { randomUUID } from "node:crypto";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../src/db/schema";
import { resolveDbUrl } from "./db-url";

neonConfig.webSocketConstructor = ws;

// Provision (or look up) the owner user and print their id — so you can get
// PRODUCT_OWNER_USER_ID without needing the magic-link email delivered.
//   pnpm owner                      # uses OWNER_EMAIL or bam@awews.com
//   pnpm owner someone@example.com  # explicit
const connectionString = resolveDbUrl(true);
if (!connectionString || connectionString.includes("placeholder")) {
  console.error("Database URL is not set. Put a real Neon connection string in .env.local.");
  process.exit(1);
}
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema, casing: "snake_case" });

const email = (process.argv[2] || process.env.OWNER_EMAIL || "bam@awews.com").trim().toLowerCase();

async function main() {
  let [u] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!u) {
    [u] = await db
      .insert(schema.users)
      .values({ id: randomUUID(), email, emailVerified: true, name: "Owner" })
      .returning();
    console.log(`Created owner user for ${email}.`);
  } else {
    console.log(`Found existing user for ${email}.`);
  }
  console.log("\n--- copy into .env.local / Vercel ---");
  console.log(`OWNER_EMAIL=${email}`);
  console.log(`PRODUCT_OWNER_USER_ID=${u.id}`);
  console.log("(Owner is also resolved by OWNER_EMAIL, so PRODUCT_OWNER_USER_ID is optional.)\n");
  await pool.end();
}

main().catch((error) => {
  console.error("owner script failed:", error);
  pool.end().finally(() => process.exit(1));
});
