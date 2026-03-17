import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
