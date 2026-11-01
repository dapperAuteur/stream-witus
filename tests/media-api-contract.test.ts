import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Structural guard (no DB, no network) for the snake_case API contract. ScopedDb
// returns camelCase Drizzle rows; the dashboard reads snake_case. A handler that
// hands a raw row straight to NextResponse.json, or a page that re-declares its own
// MediaItem shape, is how `item.media_type` came back undefined and crashed Media.

const ROOT = process.cwd();

function files(dir: string, match: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...files(full, match));
    else if (match(entry)) out.push(full);
  }
  return out;
}

const ROUTES = [
  ...files(join(ROOT, "src/app/api/media"), (n) => n === "route.ts"),
  ...files(join(ROOT, "src/app/api/podcasts"), (n) => n === "route.ts"),
];

// Variables that hold raw ScopedDb rows in these handlers. `{ relationships }` and
// `{ links }` are fine: ScopedDb already shapes those joins in snake_case.
const RAW_ROW_SHORTHAND =
  /NextResponse\.json\(\s*\{\s*(item|items|note|notes|episode|episodes|category|categories|link)\s*[,}]/;
const RAW_ROW_BARE = /NextResponse\.json\(\s*(item|note|episode|link|creators?|platforms?|categor(?:y|ies))\s*[,)]/;

describe("media API routes serialize rows before responding", () => {
  it("finds the media and podcast handlers", () => {
    expect(ROUTES.length).toBeGreaterThan(10);
  });

  it.each(ROUTES.map((f) => relative(ROOT, f)))("%s returns no raw camelCase row", (file) => {
    const src = readFileSync(join(ROOT, file), "utf8");
    expect(src).not.toMatch(RAW_ROW_SHORTHAND);
    expect(src).not.toMatch(RAW_ROW_BARE);
  });
});

describe("media UI types come from the API contract", () => {
  const UI = [
    ...files(join(ROOT, "src/app/dashboard"), (n) => n.endsWith(".tsx")),
    ...files(join(ROOT, "src/components"), (n) => n.endsWith(".tsx")),
  ];

  it.each(UI.map((f) => relative(ROOT, f)))("%s does not re-declare MediaItem or call media_type.replace", (file) => {
    const src = readFileSync(join(ROOT, file), "utf8");
    // A local copy of the shape drifts from what the API sends; import ApiMediaItem.
    expect(src).not.toMatch(/interface\s+MediaItem\b/);
    // A missing type must not throw: use mediaTypeLabel().
    expect(src).not.toMatch(/\.media_type\.replace\(/);
  });

  it("MediaCard and the detail page use ApiMediaItem", () => {
    for (const file of ["src/components/media/MediaCard.tsx", "src/app/dashboard/media/[id]/page.tsx"]) {
      expect(readFileSync(join(ROOT, file), "utf8")).toMatch(/ApiMediaItem/);
    }
  });
});
