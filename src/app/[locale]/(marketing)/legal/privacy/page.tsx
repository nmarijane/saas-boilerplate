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
      title: t("privacy"),
      description: "Privacy Policy for our platform.",
      path: "/legal/privacy",
    },
    locale
  );
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            webPageJsonLd({
              name: t("privacy"),
              description: "Privacy Policy for our platform.",
            })
          ),
        }}
      />

      <div className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight">{t("privacy")}</h1>

          <div className="mt-8 space-y-6 text-sm text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground">
                1. Information We Collect
              </h2>
              <p className="mt-2">
                We collect information you provide directly, such as when you
                create an account, update your profile, or contact us for
                support.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">
                2. How We Use Information
              </h2>
              <p className="mt-2">
                We use the information to provide, maintain, and improve the
                service, process transactions, and communicate with you.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">
                3. Data Storage
              </h2>
              <p className="mt-2">
                Your data is stored securely and we implement appropriate
                technical and organizational measures to protect your personal
                information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">
                4. Data Sharing
              </h2>
              <p className="mt-2">
                We do not sell, trade, or otherwise transfer your personal
                information to outside parties, except as described in this
                policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">
                5. Your Rights
              </h2>
              <p className="mt-2">
                You have the right to access, correct, or delete your personal
                information at any time through your account settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground">
                6. Changes to This Policy
              </h2>
              <p className="mt-2">
                We may update this privacy policy from time to time. We will
                notify you of any changes by posting the new policy on this
                page.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
