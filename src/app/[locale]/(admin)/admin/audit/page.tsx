import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuditLogTable } from "@/features/audit/components/audit-log-table";
import { getAuditLogs } from "@/features/audit/queries";
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
      title: t("auditLog"),
      description: t("title"),
      noIndex: true,
    },
    locale,
  );
}

export default async function AuditPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  let logs: Awaited<ReturnType<typeof getAuditLogs>> = [];
  try {
    logs = await getAuditLogs();
  } catch {
    // DB might not be ready
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("auditLog")}
        description={t("auditLogDescription")}
      />
      <AuditLogTable logs={logs} />
    </div>
  );
}
