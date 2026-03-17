import type { Metadata } from "next";
import { BellIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/shared/components/data/empty-state";
import { PageHeader } from "@/shared/components/data/page-header";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });

  return generatePageMetadata(
    {
      title: t("notifications"),
      description: t("title"),
      noIndex: true,
    },
    locale
  );
}

export default async function NotificationsSettingsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notifications" });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <EmptyState
        icon={BellIcon}
        title={t("noNotifications")}
        description="Your notification history will appear here."
      />
    </div>
  );
}
