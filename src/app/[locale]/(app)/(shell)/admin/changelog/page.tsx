import type { Metadata } from "next";
import { BookOpenIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { appPageMetadata } from "@/features/app-shell";
import { requireAdmin } from "@/features/auth/guards";
import { ChangelogAdminTable } from "@/features/changelog/components/changelog-admin-table";
import { CHANGELOG_LIMIT, getChangelogEntries } from "@/features/changelog/queries";
import { PageHeader } from "@/shared/components/data/page-header";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return appPageMetadata(t("changelog"), { context: t("title") });
}

// The latest entries of the changelog, for its admins. The header gives no
// count: the table is handed the last 50, and a count of them would be taken
// for the total. A list that holds the 50 it stops at says, in the card of its
// table, that it may be the latest of more, as its search and its sorting cover
// those only.
export default async function AdminChangelogPage({ params }: Props) {
  await requireAdmin();
  const { locale } = await params;
  const [t, entries] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getChangelogEntries(CHANGELOG_LIMIT),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader icon={BookOpenIcon} title={t("changelog")} />
      <ChangelogAdminTable
        entries={entries}
        note={entries.length === CHANGELOG_LIMIT ? t("changelogCapped", { shown: entries.length }) : undefined}
      />
    </div>
  );
}
