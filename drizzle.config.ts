import { defineConfig } from "drizzle-kit";
import { resolveDbUrl } from "./scripts/db-url";

// Migrations run against the UNPOOLED (direct) Neon connection; the pooled URL
// is for the app runtime. Falls back to a placeholder so `drizzle-kit generate`
// (offline diff) works with no env set.
const databaseUrl =
  resolveDbUrl(true) ?? "postgres://placeholder:placeholder@localhost/stream_witus_dev";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
