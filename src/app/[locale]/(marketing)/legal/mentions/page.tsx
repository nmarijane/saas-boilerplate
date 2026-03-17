import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { webPageJsonLd } from "@/shared/lib/jsonld";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });

  return generatePageMetadata(
    {
      title: t("mentions"),
      description: "Legal notice for our platform.",
      path: "/legal/mentions",
    },
    locale
  );
}

export default async function MentionsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            webPageJsonLd({
              name: t("mentions"),
              description: "Legal notice for our platform.",
            })
          ),
        }}
      />

      <div className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight">
            {t("mentions")}
          </h1>

          <div className="mt-8 space-y-6 text-sm text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground">
                Publisher
              </h2>
              <p className="mt-2">
                Company Name
                <br />
                Address Line 1<br />
                City, Country
                <br />
                Email: contact@example.com
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">
                Hosting
              </h2>
              <p className="mt-2">
                Hosting Provider Name
                <br />
                Address Line 1<br />
                City, Country
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">
                Credits
              </h2>
              <p className="mt-2">
                Built with Next.js, Tailwind CSS, and shadcn/ui.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
