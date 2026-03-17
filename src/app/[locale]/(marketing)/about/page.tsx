import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { webPageJsonLd } from "@/shared/lib/jsonld";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.about" });

  return generatePageMetadata(
    {
      title: t("title"),
      description: "Learn more about our mission and team.",
      path: "/about",
    },
    locale
  );
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.about" });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            webPageJsonLd({
              name: t("title"),
              description: "Learn more about our mission and team.",
            })
          ),
        }}
      />

      <div className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>

          <div className="mt-8 space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-2xl font-semibold text-foreground">
                Our Mission
              </h2>
              <p className="mt-3">
                We believe that building a SaaS product should be fast,
                affordable, and developer-friendly. Our boilerplate provides a
                solid foundation so you can focus on what makes your product
                unique.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">
                Our Approach
              </h2>
              <p className="mt-3">
                Zero recurring costs to start. Modular architecture for easy
                customization. Self-hosted first, with the option to scale to
                managed services when you need them.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">
                Tech Stack
              </h2>
              <p className="mt-3">
                Built with Next.js, TypeScript, Tailwind CSS, shadcn/ui, Better
                Auth, Drizzle ORM, Stripe, and more. Every choice is made for
                developer experience and production readiness.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
