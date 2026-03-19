import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/features/auth/guards";
import { ChangelogAdminTable } from "@/features/changelog/components/changelog-admin-table";
import { getChangelogEntries } from "@/features/changelog/queries";
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
      title: t("changelog"),
      description: t("title"),
      noIndex: true,
    },
    locale,
  );
}

export default async function AdminChangelogPage({ params }: Props) {
  await requireAdmin();
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  let entries: Awaited<ReturnType<typeof getChangelogEntries>> = [];
  try {
    entries = await getChangelogEntries();
  } catch {
    // DB might not be ready
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("changelog")} />
      <ChangelogAdminTable entries={entries} />
    </div>
  );
}
