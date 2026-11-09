import { describe, expect, it } from "vitest";
import { DEFAULT_RETURN_PATH, safeReturnPath, signInHref } from "@/lib/return-to";

// A 401 sends the visitor to sign in and back (witus docs/shared-ui-ux-dx.md). The return path is
// read from the query string, so it must never become an open redirect.
describe("safeReturnPath", () => {
  it("keeps a same-origin path with its query", () => {
    expect(safeReturnPath("/dashboard/clubs/abc?tab=2")).toBe("/dashboard/clubs/abc?tab=2");
    expect(safeReturnPath("/episodes")).toBe("/episodes");
  });

  it.each([
    ["absolute URL", "https://evil.example/dashboard"],
    ["protocol-relative", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["embedded backslash", "/dashboard\\..\\evil"],
    ["javascript scheme", "javascript:alert(1)"],
    ["relative path", "dashboard/media"],
    ["control character", "/dashboard\n/media"],
    ["sign-in loop", "/signin?next=/dashboard"],
    ["auth API", "/api/auth/sign-out"],
    ["empty", ""],
    ["not a string", ["/dashboard/media"]],
    ["missing", undefined],
  ])("refuses %s", (_label, value) => {
    expect(safeReturnPath(value)).toBe(DEFAULT_RETURN_PATH);
  });

  it("uses the caller's fallback", () => {
    expect(safeReturnPath("//evil.example", "/")).toBe("/");
  });
});

describe("signInHref", () => {
  it("carries the protected path as ?next=", () => {
    expect(signInHref("/dashboard/clubs/abc")).toBe("/signin?next=%2Fdashboard%2Fclubs%2Fabc");
  });

  it("is plain /signin when there is nothing useful to return to", () => {
    expect(signInHref(null)).toBe("/signin");
    expect(signInHref("https://evil.example")).toBe("/signin");
    expect(signInHref(DEFAULT_RETURN_PATH)).toBe("/signin");
  });
});
