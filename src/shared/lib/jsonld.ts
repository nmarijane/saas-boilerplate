const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function organizationJsonLd(name: string, url: string = APP_URL) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
  };
}

export function webSiteJsonLd(name: string, url: string = APP_URL) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
  };
}

export function faqPageJsonLd(
  questions: Array<{ question: string; answer: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };
}

export function productJsonLd(opts: {
  name: string;
  description: string;
  url?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: opts.name,
    description: opts.description,
    url: opts.url ?? APP_URL,
  };
}

export function offerJsonLd(opts: {
  name: string;
  price: number;
  currency?: string;
  url?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: opts.name,
    price: opts.price,
    priceCurrency: opts.currency ?? "USD",
    url: opts.url ?? APP_URL,
  };
}

export function articleJsonLd(opts: {
  headline: string;
  datePublished: string;
  author?: string;
  url?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    datePublished: opts.datePublished,
    ...(opts.author && { author: { "@type": "Person", name: opts.author } }),
    url: opts.url ?? APP_URL,
  };
}

export function webPageJsonLd(opts: {
  name: string;
  description: string;
  url?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: opts.name,
    description: opts.description,
    url: opts.url ?? APP_URL,
  };
}
