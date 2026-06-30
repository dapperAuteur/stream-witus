import { type NextRequest, NextResponse } from "next/server";
import { badRequest, unauthorized } from "@/lib/api";
import { getSessionUserId } from "@/lib/session";

// Server-side URL scraper (CentOS parity): fetch a page, extract JSON-LD then fall
// back to Open Graph, and return a prefill for the add form. No DB write — auth-only.
// In Phase 4 this becomes the fallback behind Open Library / TMDB lookups.

interface Prefill {
  title?: string;
  creator?: string;
  cover_image_url?: string;
  year_released?: number;
  external_url: string;
}

function firstMeta(html: string, property: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  return html.match(re)?.[1];
}

function fromJsonLd(html: string): Partial<Prefill> {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, raw] of blocks) {
    try {
      const data = JSON.parse(raw.trim());
      const node = Array.isArray(data) ? data[0] : (data["@graph"]?.[0] ?? data);
      if (!node || typeof node !== "object") continue;
      const author = node.author?.name ?? (typeof node.author === "string" ? node.author : undefined);
      const year = node.datePublished ? Number(String(node.datePublished).slice(0, 4)) : undefined;
      return {
        title: typeof node.name === "string" ? node.name : undefined,
        creator: author,
        cover_image_url: typeof node.image === "string" ? node.image : node.image?.url,
        year_released: Number.isFinite(year) ? year : undefined,
      };
    } catch {
      // try the next block
    }
  }
  return {};
}

export async function POST(request: NextRequest) {
  if (!(await getSessionUserId())) return unauthorized();

  const body = await request.json();
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!/^https?:\/\//i.test(url)) return badRequest("A valid http(s) url is required");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Stream.WitUS/1.0 (+https://stream.witus.online)" },
      signal: controller.signal,
    });
    if (!res.ok) return badRequest(`Fetch failed (${res.status})`);
    html = await res.text();
  } catch {
    return badRequest("Could not fetch the URL (timeout or network error)");
  } finally {
    clearTimeout(timeout);
  }

  const jsonLd = fromJsonLd(html);
  const ogYear = firstMeta(html, "og:video:release_date") ?? firstMeta(html, "book:release_date");
  const prefill: Prefill = {
    external_url: url,
    title: jsonLd.title ?? firstMeta(html, "og:title") ?? html.match(/<title>([^<]+)<\/title>/i)?.[1],
    creator: jsonLd.creator ?? firstMeta(html, "author") ?? firstMeta(html, "book:author"),
    cover_image_url: jsonLd.cover_image_url ?? firstMeta(html, "og:image"),
    year_released:
      jsonLd.year_released ?? (ogYear ? Number(String(ogYear).slice(0, 4)) || undefined : undefined),
  };

  return NextResponse.json({ prefill });
}
