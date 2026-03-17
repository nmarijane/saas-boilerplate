import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdminOrgsTable } from "@/features/admin/components/admin-orgs-table";
import { getAdminOrganizations } from "@/features/admin/queries";
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
      title: t("organizations"),
      description: t("title"),
      noIndex: true,
    },
    locale
  );
}

export default async function AdminOrganizationsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  let orgs: Awaited<ReturnType<typeof getAdminOrganizations>> = [];
  try {
    orgs = await getAdminOrganizations();
  } catch {
    // DB might not be ready
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("organizations")} />
      <AdminOrgsTable organizations={orgs} />
    </div>
  );
}
