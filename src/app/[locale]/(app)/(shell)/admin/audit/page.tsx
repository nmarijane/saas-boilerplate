import type { Metadata } from "next";
import { ClipboardListIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { appPageMetadata } from "@/features/app-shell";
import { AuditLogTable } from "@/features/audit/components/audit-log-table";
import { AUDIT_LOG_LIMIT, getAuditLogs } from "@/features/audit/queries";
import { requireAdmin } from "@/features/auth/guards";
import { PageHeader } from "@/shared/components/data/page-header";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return appPageMetadata(t("auditLog"), { context: t("title") });
}

// The latest events of the platform, for its admins. The header gives no count
// and no line: the table is handed the last 50, and the log grows without end, so
// the number of rows is not the number of events, and the list is not "all the
// activity". A list that holds the 50 it stops at says, in the card of its table,
// that it may be the latest of more, as its search and its sorting cover those only.
export default async function AuditPage({ params }: Props) {
  await requireAdmin();
  const { locale } = await params;
  const [t, logs] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getAuditLogs(AUDIT_LOG_LIMIT),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader icon={ClipboardListIcon} title={t("auditLog")} />
      <AuditLogTable
        logs={logs}
        note={logs.length === AUDIT_LOG_LIMIT ? t("auditCapped", { shown: logs.length }) : undefined}
      />
    </div>
  );
}
