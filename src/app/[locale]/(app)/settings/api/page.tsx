import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ApiKeyList } from "@/features/api-keys/components/api-key-list";
import { getApiKeysForOrg } from "@/features/api-keys/queries";
import { requireAuth } from "@/features/auth/guards";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { WebhookList } from "@/features/webhooks/components/webhook-list";
import { getWebhookEndpointsForOrg } from "@/features/webhooks/queries";
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
      title: t("api"),
      description: t("apiDescription"),
      noIndex: true,
    },
    locale,
  );
}

export default async function ApiSettingsPage({ params }: Props) {
  const session = await requireAuth();
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });

  const orgId = await getActiveOrgId();
  if (!orgId) {
    redirect("/dashboard");
  }

  let apiKeys: Awaited<ReturnType<typeof getApiKeysForOrg>> = [];
  let webhooks: Awaited<ReturnType<typeof getWebhookEndpointsForOrg>> = [];

  try {
    [apiKeys, webhooks] = await Promise.all([
      getApiKeysForOrg(orgId),
      getWebhookEndpointsForOrg(orgId),
    ]);
  } catch {
    // DB might not be ready
  }

  return (
    <div className="space-y-8">
      <PageHeader title={t("api")} description={t("apiDescription")} />
      <ApiKeyList keys={apiKeys} orgId={orgId} userId={session.user.id} />
      <WebhookList endpoints={webhooks} orgId={orgId} userId={session.user.id} />
    </div>
  );
}
