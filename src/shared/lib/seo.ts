import type { Metadata } from "next";
import { APP_NAME, DEV_APP_URL } from "@/shared/config/app";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? DEV_APP_URL;

interface PageMetaOptions {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}

export function generatePageMetadata(
  options: PageMetaOptions,
  locale: string,
): Metadata {
  const { title, description, path = "", image, noIndex } = options;
  const url = `${APP_URL}/${locale}${path}`;

  return {
    title: `${title} | ${APP_NAME}`,
    description,
    alternates: {
      canonical: url,
      languages: {
        en: `${APP_URL}/en${path}`,
        fr: `${APP_URL}/fr${path}`,
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: APP_NAME,
      locale,
      type: "website",
      ...(image && { images: [{ url: image }] }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image && { images: [image] }),
    },
    ...(noIndex && {
      robots: { index: false, follow: false },
    }),
  };
}
