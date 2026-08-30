import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { BLOG_POSTS } from "@/lib/blog/posts";

/*
  Only the pages robots.ts allows: the marketing front door, the blog,
  and the legal pages. Nothing behind auth, nothing tokenized — a
  sitemap is a public index, and the product's whole privacy posture
  is that the record is not public.
*/
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.appUrl;
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...BLOG_POSTS.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy/extension`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/community-guidelines`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
