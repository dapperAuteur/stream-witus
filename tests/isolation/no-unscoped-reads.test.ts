import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Structural half of the Phase 2 gate (runs with no DB). The owner-scoped
// invariant is only as strong as its weakest route: a single handler importing
// the raw Drizzle client could run an unscoped read. This test fails the build if
// any API route bypasses the chokepoint. Only scoped.ts and auth.ts may touch
// `@/db/client` directly.
const API_DIR = join(process.cwd(), "src/app/api");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

describe("no unscoped reads in API routes", () => {
  const files = routeFiles(API_DIR);

  it("finds the ported route handlers", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.filter((f) => !f.includes(`${join("api", "auth")}`)))(
    "%s does not import the raw db client",
    (file) => {
      const src = readFileSync(file, "utf8");
      // The raw client (`@/db/client`) is the chokepoint's private dependency.
      // Routes must go through getScopedDb / getSessionUserId instead.
      expect(src).not.toMatch(/from\s+["']@\/db\/client["']/);
      expect(src).not.toMatch(/from\s+["'].*db\/client["']/);
    },
  );
});
