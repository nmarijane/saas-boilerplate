import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AchievementGrid } from "@/features/achievements/components/achievement-grid";
import { requireAuth } from "@/features/auth/guards";
import { PageHeader } from "@/shared/components/data/page-header";
import { Card, CardContent } from "@/shared/components/ui/card";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "achievements" });

  return generatePageMetadata(
    {
      title: t("title"),
      description: t("description"),
      noIndex: true,
    },
    locale,
  );
}

export default async function AchievementsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "achievements" });
  await requireAuth();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <CardContent className="pt-6">
          <AchievementGrid />
        </CardContent>
      </Card>
    </div>
  );
}
