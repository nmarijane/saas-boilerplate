import type { Metadata } from "next";
import { FlagIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { appPageMetadata } from "@/features/app-shell";
import { requireAdmin } from "@/features/auth/guards";
import { FlagAdminTable } from "@/features/feature-flags/components/flag-admin-table";
import { getAllFeatureFlags } from "@/features/feature-flags/queries";
import { PageHeader } from "@/shared/components/data/page-header";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return appPageMetadata(t("featureFlags"), { context: t("title") });
}

// Every feature flag of the platform, for its admins. The list has no limit,
// so its length is the total the header gives.
export default async function FeaturesPage({ params }: Props) {
  await requireAdmin();
  const { locale } = await params;
  const [t, flags] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getAllFeatureFlags(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FlagIcon}
        title={t("featureFlags")}
        context={t("featureFlagsCount", { count: flags.length })}
      />
      <FlagAdminTable flags={flags} />
    </div>
  );
}
