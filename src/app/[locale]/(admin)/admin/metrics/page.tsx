import type { Metadata } from "next";
import { BuildingIcon, DollarSignIcon, UsersIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getAdminMetrics } from "@/features/admin/queries";
import { PageHeader } from "@/shared/components/data/page-header";
import { StatCard } from "@/shared/components/data/stat-card";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return generatePageMetadata(
    {
      title: t("metrics"),
      description: t("title"),
      noIndex: true,
    },
    locale
  );
}

export default async function AdminMetricsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  let metrics = { totalUsers: 0, totalOrganizations: 0, mrr: 0 };
  try {
    metrics = await getAdminMetrics();
  } catch {
    // DB might not be ready
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("metrics")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t("totalUsers")}
          value={metrics.totalUsers}
          icon={UsersIcon}
        />
        <StatCard
          title={t("totalOrgs")}
          value={metrics.totalOrganizations}
          icon={BuildingIcon}
        />
        <StatCard
          title={t("mrr")}
          value={`$${(metrics.mrr / 100).toFixed(2)}`}
          icon={DollarSignIcon}
        />
      </div>
    </div>
  );
}
