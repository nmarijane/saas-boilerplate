import type { Metadata } from "next";
import {
  ActivityIcon,
  CreditCardIcon,
  FolderIcon,
  UsersIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/shared/components/data/empty-state";
import { PageHeader } from "@/shared/components/data/page-header";
import { StatCard } from "@/shared/components/data/stat-card";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });

  return generatePageMetadata(
    {
      title: t("title"),
      description: t("overview"),
      noIndex: true,
    },
    locale
  );
}

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("overview")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Members"
          value="0"
          icon={UsersIcon}
        />
        <StatCard
          title="Revenue"
          value="$0"
          icon={CreditCardIcon}
        />
        <StatCard
          title="Activity"
          value="0"
          icon={ActivityIcon}
        />
        <StatCard
          title="Projects"
          value="0"
          icon={FolderIcon}
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">{t("recentActivity")}</h2>
        <EmptyState
          icon={ActivityIcon}
          title={t("noActivity")}
          description="Your recent activity will appear here once you start using the platform."
        />
      </div>
    </div>
  );
}
