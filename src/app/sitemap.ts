import type { MetadataRoute } from "next";
import { routing } from "@/shared/lib/i18n-routing";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const publicPages = [
  "",
  "/pricing",
  "/about",
  "/changelog",
  "/legal/terms",
  "/legal/privacy",
  "/legal/mentions",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of publicPages) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${APP_URL}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === "" ? "weekly" : "monthly",
        priority: page === "" ? 1 : 0.8,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((l) => [l, `${APP_URL}/${l}${page}`]),
          ),
        },
      });
    }
  }

  return entries;
}
