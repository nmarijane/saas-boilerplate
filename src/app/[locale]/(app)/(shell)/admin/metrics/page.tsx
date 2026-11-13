import type { Metadata } from "next";
import { BarChartIcon, BuildingIcon, DollarSignIcon, UsersIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAdminMetrics } from "@/features/admin/queries";
import { appPageMetadata } from "@/features/app-shell";
import { requireAdmin } from "@/features/auth/guards";
import { PageHeader } from "@/shared/components/data/page-header";
import { StatCard } from "@/shared/components/data/stat-card";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return appPageMetadata(t("metrics"), { context: t("title") });
}

// The figures of the platform, for its admins. The header has no line under its
// title: the page is made of counts, and none is told twice.
export default async function AdminMetricsPage({ params }: Props) {
  await requireAdmin();
  const { locale } = await params;
  const [t, format, metrics] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getFormatter({ locale }),
    getAdminMetrics(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader icon={BarChartIcon} title={t("metrics")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t("totalUsers")}
          value={format.number(metrics.totalUsers)}
          icon={UsersIcon}
        />
        <StatCard
          title={t("totalOrgs")}
          value={format.number(metrics.totalOrganizations)}
          icon={BuildingIcon}
        />
        <StatCard
          title={t("mrr")}
          // Plan prices are stored in US cents: the revenue is in dollars, written the way the language of the page writes them
          value={format.number(metrics.mrr / 100, { style: "currency", currency: "USD" })}
          icon={DollarSignIcon}
        />
      </div>
    </div>
  );
}
