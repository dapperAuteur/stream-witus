import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SIGN_IN_HREF, SIGN_IN_LABEL, footerAppLinks, isCurrent, primaryNav } from "@/lib/site-nav";

const APP = join(__dirname, "..", "src", "app");

/** True when an internal href is served by a page or route file in src/app. */
function routeExists(href: string): boolean {
  const path = href === "/" ? "" : href.replace(/^\//, "");
  return ["page.tsx", "route.ts"].some((f) => existsSync(join(APP, path, f)));
}

describe("site header navigation", () => {
  it("names the sign-in control exactly 'Sign in' and points at /signin (shared UI rule)", () => {
    expect(SIGN_IN_LABEL).toBe("Sign in");
    expect(SIGN_IN_HREF).toBe("/signin");
  });

  it("shows only public sections to a signed-out visitor", () => {
    expect(primaryNav({ signedIn: false, isAdmin: false }).map((i) => i.href)).toEqual(["/episodes", "/clubs"]);
  });

  it("adds the dashboard sections when signed in, and Admin only for admins", () => {
    const member = primaryNav({ signedIn: true, isAdmin: false }).map((i) => i.href);
    expect(member).toEqual(["/dashboard/media", "/dashboard/clubs", "/episodes", "/clubs"]);
    expect(primaryNav({ signedIn: true, isAdmin: true }).map((i) => i.href)).toContain("/dashboard/admin");
    expect(member).not.toContain("/dashboard/admin");
  });

  it("links only to routes that exist", () => {
    const hrefs = [
      ...primaryNav({ signedIn: true, isAdmin: true }),
      ...footerAppLinks(false),
      ...footerAppLinks(true),
    ].map((i) => i.href);
    for (const href of hrefs) expect(routeExists(href), href).toBe(true);
  });

  it("offers Sign in in the footer only when signed out", () => {
    expect(footerAppLinks(false).some((l) => l.label === SIGN_IN_LABEL)).toBe(true);
    expect(footerAppLinks(true).some((l) => l.label === SIGN_IN_LABEL)).toBe(false);
  });

  it("marks the current section on a path-segment boundary", () => {
    expect(isCurrent("/dashboard/media/123", "/dashboard/media")).toBe(true);
    expect(isCurrent("/clubs", "/clubs")).toBe(true);
    expect(isCurrent("/clubsfoo", "/clubs")).toBe(false);
    expect(isCurrent("/episodes", "/")).toBe(false);
    expect(isCurrent(null, "/clubs")).toBe(false);
  });
});
