// Resolve the Neon connection string across the names the Vercel–Neon integration
// may provision. THIS PROJECT prefixes its DB vars with STORAGE_ (per BAM), but we
// also accept the plain / POSTGRES_ forms so a hand-set URL works too. Shared by
// drizzle.config, migrate, and the seed script so they behave like the app's env.ts.
export function resolveDbUrl(preferDirect = false): string | undefined {
  const direct = [
    "STORAGE_DATABASE_URL_UNPOOLED",
    "DATABASE_URL_UNPOOLED",
    "STORAGE_POSTGRES_URL_NON_POOLING",
    "POSTGRES_URL_NON_POOLING",
  ];
  const pooled = [
    "STORAGE_DATABASE_URL",
    "DATABASE_URL",
    "STORAGE_POSTGRES_URL",
    "POSTGRES_URL",
  ];
  const order = preferDirect ? [...direct, ...pooled] : [...pooled, ...direct];
  for (const n of order) if (process.env[n]) return process.env[n];
  return undefined;
}
