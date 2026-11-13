import type { Metadata } from "next";
import { BuildingIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AdminOrgsTable } from "@/features/admin/components/admin-orgs-table";
import { countOrganizations, getAdminOrganizations } from "@/features/admin/queries";
import { appPageMetadata } from "@/features/app-shell";
import { requireAdmin } from "@/features/auth/guards";
import { PageHeader } from "@/shared/components/data/page-header";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return appPageMetadata(t("organizations"), { context: t("title") });
}

// The organizations of the platform, for its admins: the guard again, the
// total from its own query (the table is handed the newest 100, and its card
// says so when there are more), and no catch round the queries, as on the page
// of the users.
export default async function AdminOrganizationsPage({ params }: Props) {
  await requireAdmin();
  const { locale } = await params;
  const [t, organizations, total] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getAdminOrganizations(),
    countOrganizations(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BuildingIcon}
        title={t("organizations")}
        context={t("organizationsCount", { count: total })}
      />
      <AdminOrgsTable
        organizations={organizations}
        note={
          total > organizations.length
            ? t("organizationsCapped", { shown: organizations.length, total })
            : undefined
        }
      />
    </div>
  );
}
