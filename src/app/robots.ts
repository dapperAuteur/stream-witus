import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Owner tools and API are not for crawlers.
      disallow: ["/dashboard", "/api", "/signin"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
