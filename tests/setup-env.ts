// Load .env.local for the test run so the DB-integration isolation suite can
// reach Neon. Guarded: if the file is absent (CI without secrets), the suite
// stays skipped instead of failing — `pnpm test` is green either way.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — DB-integration tests will skip (hasTestDb === false)
}
