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
      title: t("terms"),
      description: "Terms of Service for our platform.",
      path: "/legal/terms",
    },
    locale
  );
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            webPageJsonLd({
              name: t("terms"),
              description: "Terms of Service for our platform.",
            })
          ),
        }}
      />

      <div className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight">{t("terms")}</h1>

          <div className="mt-8 space-y-6 text-sm text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground">
                1. Acceptance of Terms
              </h2>
              <p className="mt-2">
                By accessing and using this service, you accept and agree to be
                bound by the terms and provisions of this agreement.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">
                2. Use of Service
              </h2>
              <p className="mt-2">
                You agree to use the service only for purposes that are legal,
                proper, and in accordance with these terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">
                3. User Accounts
              </h2>
              <p className="mt-2">
                You are responsible for safeguarding the password that you use to
                access the service and for any activities or actions under your
                password.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">
                4. Intellectual Property
              </h2>
              <p className="mt-2">
                The service and its original content, features, and
                functionality are owned by us and are protected by international
                copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">
                5. Termination
              </h2>
              <p className="mt-2">
                We may terminate or suspend your access to our service
                immediately, without prior notice, for any reason.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">
                6. Changes to Terms
              </h2>
              <p className="mt-2">
                We reserve the right to modify these terms at any time. Changes
                will be effective immediately upon posting to the website.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
