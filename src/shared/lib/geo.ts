import type { Metadata } from "next";

export function geoMetaTags(): Metadata {
  return {
    other: {
      "ai-content-declaration": "This website provides original human-created content.",
      "ai-crawl-permission": "allowed",
    },
  };
}
