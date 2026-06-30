import "server-only";
import { env, hasTmdb } from "./env";

// Phase 4 auto-metadata. Open Library (no key) covers books; TMDB (key from task
// 05) covers movies/TV. Each provider fails soft — a missing key or a network
// error yields [] rather than throwing, so the lookup UI degrades gracefully.

export interface MetadataResult {
  source: "openlibrary" | "tmdb";
  externalId: string;
  title: string;
  creator: string | null;
  yearReleased: number | null;
  coverImageUrl: string | null;
  synopsis: string | null;
  mediaType: "book" | "movie" | "tv_show";
}

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Stream.WitUS/1.0 (+https://stream.witus.online)" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[metadata] ${url} -> HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[metadata] ${url} -> ${err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
}

async function searchOpenLibrary(q: string): Promise<MetadataResult[]> {
  const url =
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}` +
    `&limit=8&fields=key,title,author_name,first_publish_year,cover_i`;
  const data = (await fetchJson(url)) as { docs?: OpenLibraryDoc[] } | null;
  if (!data?.docs) return [];
  return data.docs
    .slice(0, 8)
    .map<MetadataResult>((d) => ({
      source: "openlibrary",
      externalId: String(d.key ?? ""),
      title: d.title ?? "Untitled",
      creator: d.author_name?.[0] ?? null,
      yearReleased: typeof d.first_publish_year === "number" ? d.first_publish_year : null,
      coverImageUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
      synopsis: null,
      mediaType: "book",
    }))
    .filter((r) => r.externalId);
}

interface TmdbResult {
  id?: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
}

function mapTmdb(r: TmdbResult): MetadataResult | null {
  // The multi endpoint tags media_type; the typed endpoints don't, so infer from
  // which title field is present (movies have `title`, TV has `name`).
  const mt = r.media_type ?? (r.title ? "movie" : "tv");
  if (mt !== "movie" && mt !== "tv") return null;
  const title = r.title ?? r.name;
  if (!title || r.id == null) return null;
  const date = r.release_date ?? r.first_air_date ?? "";
  const year = date ? Number(date.slice(0, 4)) || null : null;
  return {
    source: "tmdb",
    externalId: String(r.id),
    title,
    creator: null, // search results don't include director/creator
    yearReleased: year,
    coverImageUrl: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
    synopsis: r.overview || null,
    mediaType: mt === "tv" ? "tv_show" : "movie",
  };
}

async function searchTmdb(q: string, type?: "movie" | "tv_show"): Promise<MetadataResult[]> {
  if (!hasTmdb) return [];
  const endpoint = type === "movie" ? "movie" : type === "tv_show" ? "tv" : "multi";
  const url =
    `https://api.themoviedb.org/3/search/${endpoint}?api_key=${env.TMDB_API_KEY}` +
    `&query=${encodeURIComponent(q)}&include_adult=false&page=1`;
  const data = (await fetchJson(url)) as { results?: TmdbResult[] } | null;
  if (!data?.results) return [];
  return data.results
    .map(mapTmdb)
    .filter((r): r is MetadataResult => r !== null)
    .slice(0, 8);
}

/** Dispatch by media type: books → Open Library, movies/TV → TMDB, else → both. */
export async function searchMetadata(q: string, type?: string): Promise<MetadataResult[]> {
  if (!q.trim()) return [];
  if (type === "book") return searchOpenLibrary(q);
  if (type === "movie" || type === "tv_show") return searchTmdb(q, type);
  const [screen, books] = await Promise.all([searchTmdb(q), searchOpenLibrary(q)]);
  return [...screen, ...books];
}
