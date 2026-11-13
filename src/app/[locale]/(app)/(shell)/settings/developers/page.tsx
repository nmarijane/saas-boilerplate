import type { Metadata } from "next";
import { CodeXmlIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ApiKeyList } from "@/features/api-keys/components/api-key-list";
import { CreateKeyButton } from "@/features/api-keys/components/create-key-button";
import { apiKeyStatus } from "@/features/api-keys/key-status";
import {
  countActiveApiKeys,
  getApiKeysForOrg,
} from "@/features/api-keys/queries";
import { appPageMetadata } from "@/features/app-shell";
import { requireRole } from "@/features/auth/guards";
import { requireWorkspace } from "@/features/auth/organization/workspace";
import { WebhookList } from "@/features/webhooks/components/webhook-list";
import { getWebhookEndpointsForOrg } from "@/features/webhooks/queries";
import { PageHeader } from "@/shared/components/data/page-header";
import { SettingsNav } from "@/shared/components/shell/settings-nav";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings.developers" });

  return appPageMetadata(t("title"));
}

// The keys and the webhook endpoints of the workspace, read on the server for the
// workspace of the session: the page takes it from `requireWorkspace()`, never
// from the URL, so that no one reads those of another. The page is for the admins
// and the owner: anyone else is sent to the home, as the tab is not drawn for
// them either. The header counts the keys that can still be used (a key that was
// revoked, or has run out, is kept in the list for the record, and no longer
// opens the API) and every endpoint (one that is turned off still exists, and
// can be turned on again); the sections carry no count of their own. Its one
// main action makes a key, and the section of the endpoints has a secondary
// button of its own. The lists are given what they show and nothing else: no
// hash of a key, no signing secret, dates as ISO strings, and the status of each
// key worked out here, with the clock of the server.
export default async function DevelopersSettingsPage({ params }: Props) {
  const { locale } = await params;
  const { workspace } = await requireWorkspace();
  await requireRole(workspace.id, "admin");
  const [t, keys, activeKeys, endpoints] = await Promise.all([
    getTranslations({ locale, namespace: "settings.developers" }),
    getApiKeysForOrg(workspace.id),
    countActiveApiKeys(workspace.id),
    getWebhookEndpointsForOrg(workspace.id),
  ]);

  const now = new Date();
  const keyItems = keys.map((key) => ({
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    status: apiKeyStatus(key, now),
    createdAt: key.createdAt.toISOString(),
    lastUsed: key.lastUsed?.toISOString() ?? null,
  }));
  const endpointItems = endpoints.map((endpoint) => ({
    id: endpoint.id,
    url: endpoint.url,
    active: endpoint.active,
    eventCount: endpoint.events.length,
    createdAt: endpoint.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CodeXmlIcon}
        title={t("title")}
        context={t("context", {
          keys: activeKeys,
          endpoints: endpoints.length,
        })}
        primaryAction={<CreateKeyButton orgId={workspace.id} />}
        tabs={<SettingsNav />}
      />
      <ApiKeyList orgId={workspace.id} keys={keyItems} />
      <WebhookList orgId={workspace.id} endpoints={endpointItems} />
    </div>
  );
}
