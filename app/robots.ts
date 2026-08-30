import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/*
  Crawlers get the marketing site and nothing else. /app is a private
  product behind auth, /r holds tokenized share links (each page also
  carries its own noindex — this is the belt to that suspender), and
  /api is plumbing. The sitemap lists only what robots may visit.
*/
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/r/", "/api/", "/pay/", "/join/"],
    },
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
