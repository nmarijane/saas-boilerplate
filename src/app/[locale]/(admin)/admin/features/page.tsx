import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/features/auth/guards";
import { FlagAdminTable } from "@/features/feature-flags/components/flag-admin-table";
import { getAllFeatureFlags } from "@/features/feature-flags/queries";
import { PageHeader } from "@/shared/components/data/page-header";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return generatePageMetadata(
    {
      title: t("featureFlags"),
      description: t("featureFlagsDescription"),
      noIndex: true,
    },
    locale,
  );
}

export default async function FeaturesPage({ params }: Props) {
  await requireAdmin();
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  let flags: Awaited<ReturnType<typeof getAllFeatureFlags>> = [];
  try {
    flags = await getAllFeatureFlags();
  } catch {
    // DB might not be ready
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("featureFlags")}
        description={t("featureFlagsDescription")}
      />
      <FlagAdminTable flags={flags} />
    </div>
  );
}
