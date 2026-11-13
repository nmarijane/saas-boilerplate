import type { Metadata } from "next";
import { UsersIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AdminUsersTable } from "@/features/admin/components/admin-users-table";
import { countUsers, getAdminUsers } from "@/features/admin/queries";
import { appPageMetadata } from "@/features/app-shell";
import { requireAdmin } from "@/features/auth/guards";
import { PageHeader } from "@/shared/components/data/page-header";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return appPageMetadata(t("users"), { context: t("title") });
}

// The users of the platform, for its admins. The guard is asked again here: the
// layout is not run again on every navigation inside it. The header counts the
// users there are, from a query of its own: the table is handed the newest 100,
// and their number is not the total. When there are more, the card of the table
// says so, as its search and its sorting cover those 100 only. A failed query is
// not caught, so that it reaches the error boundary of the route instead of
// drawing an empty table.
export default async function AdminUsersPage({ params }: Props) {
  await requireAdmin();
  const { locale } = await params;
  const [t, users, total] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getAdminUsers(),
    countUsers(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UsersIcon}
        title={t("users")}
        context={t("usersCount", { count: total })}
      />
      <AdminUsersTable
        users={users}
        note={total > users.length ? t("usersCapped", { shown: users.length, total }) : undefined}
      />
    </div>
  );
}
