import { NextResponse } from "next/server";

// Shared JSON responses for the ported /api/media/* handlers. Keeps the CentOS
// response contract ({ error }, { item }, { items, total }, { ok }) intact so the
// Phase 3 UI ports over unchanged.

export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

/** CentOS-compatible coercion: arrays pass through; `a;b;c` strings split on `;`. */
export function toStringArray(val: unknown): string[] | null {
  if (!val) return null;
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string")
    return val
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
  return null;
}
