import type { MetadataRoute } from "next";
import { DEV_APP_URL } from "@/shared/config/app";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? DEV_APP_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/*/dashboard", "/*/settings", "/*/admin", "/*/onboarding", "/api/"],
      },
      {
        userAgent: "GPTBot",
        allow: ["/"],
        disallow: ["/*/dashboard", "/*/settings", "/*/admin", "/*/onboarding", "/api/"],
      },
      {
        userAgent: "ClaudeBot",
        allow: ["/"],
        disallow: ["/*/dashboard", "/*/settings", "/*/admin", "/*/onboarding", "/api/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: ["/"],
        disallow: ["/*/dashboard", "/*/settings", "/*/admin", "/*/onboarding", "/api/"],
      },
      {
        userAgent: "Google-Extended",
        allow: ["/"],
        disallow: ["/*/dashboard", "/*/settings", "/*/admin", "/*/onboarding", "/api/"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
