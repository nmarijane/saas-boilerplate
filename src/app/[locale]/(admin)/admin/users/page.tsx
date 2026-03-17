import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdminUsersTable } from "@/features/admin/components/admin-users-table";
import { getAdminUsers } from "@/features/admin/queries";
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
      title: t("users"),
      description: t("title"),
      noIndex: true,
    },
    locale
  );
}

export default async function AdminUsersPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  let users: Awaited<ReturnType<typeof getAdminUsers>> = [];
  try {
    users = await getAdminUsers();
  } catch {
    // DB might not be ready
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("users")} />
      <AdminUsersTable users={users} />
    </div>
  );
}
