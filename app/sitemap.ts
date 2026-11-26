import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/site";

/** Plan du site : uniquement les pages publiques. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/performances", priority: 0.8, changeFrequency: "daily" },
    { path: "/inscription", priority: 0.7, changeFrequency: "monthly" },
    { path: "/connexion", priority: 0.4, changeFrequency: "monthly" },
    { path: "/jeu-responsable", priority: 0.4, changeFrequency: "monthly" },
    { path: "/cgu", priority: 0.3, changeFrequency: "monthly" },
  ];
  return pages.map((page) => ({ url: new URL(page.path, base).toString(), changeFrequency: page.changeFrequency, priority: page.priority }));
}
