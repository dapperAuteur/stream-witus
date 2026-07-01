import type { MetadataRoute } from "next";
import { listPublicClubs, listPublicEpisodes } from "@/db/public";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const [episodes, clubs] = await Promise.all([listPublicEpisodes(), listPublicClubs()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "monthly" },
    { url: `${base}/episodes`, changeFrequency: "weekly" },
    { url: `${base}/clubs`, changeFrequency: "weekly" },
    { url: `${base}/shelf`, changeFrequency: "weekly" },
    { url: `${base}/connect`, changeFrequency: "yearly" },
    { url: `${base}/pitch`, changeFrequency: "yearly" },
  ];

  const episodeRoutes: MetadataRoute.Sitemap = episodes.map((ep) => ({
    url: `${base}/episodes/${ep.id}`,
    changeFrequency: "monthly",
  }));

  const clubRoutes: MetadataRoute.Sitemap = clubs.map((c) => ({
    url: `${base}/clubs/${c.slug}`,
    lastModified: c.updatedAt ?? undefined,
    changeFrequency: "weekly",
  }));

  return [...staticRoutes, ...episodeRoutes, ...clubRoutes];
}
