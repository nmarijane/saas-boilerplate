import type { Metadata } from "next";
import { BotIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Chat } from "@/features/ai/components/chat";
import { AI_CREDITS_QUOTA_ID } from "@/features/ai/config/credits";
import { getAvailableModels } from "@/features/ai/config/models";
import { getAvailableProviders, PROVIDER_ENV_KEYS } from "@/features/ai/config/providers";
import { getConversations, getMessages } from "@/features/ai/queries";
import { ensureMonthlyAllocation } from "@/features/ai/service";
import { appPageMetadata, getShell } from "@/features/app-shell";
import { requireWorkspace } from "@/features/auth/organization/workspace";
import { EmptyState } from "@/shared/components/data/empty-state";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ai" });

  return appPageMetadata(t("title"));
}

// The assistant of the workspace the person works in: the page takes it from
// `requireWorkspace()`, as every page of the workspace does, so that the shell,
// the conversation and the credits are those of one workspace. It opens the
// latest conversation of the person there, or none: viewing the page writes
// nothing, and the first message starts the conversation (the chat route).
// The chat fills the screen, so the one h1 of the page is for screen readers
// alone; with no model that can run, the empty state is the page, and its title
// the h1.
export default async function AIPage({ params }: Props) {
  const { locale } = await params;
  const { user, workspace } = await requireWorkspace();
  const availableModels = getAvailableModels(getAvailableProviders());
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: "ai" }),
    getFormatter({ locale }),
  ]);

  // No model of the list can run: say which variables turn the assistant on. A provider
  // alone is not enough (Ollama is wired as one, and no model of the list runs on it)
  if (availableModels.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={BotIcon}
          headingLevel={1}
          title={t("noProviders")}
          description={t("noProvidersDescription", {
            variables: format.list([...PROVIDER_ENV_KEYS], { type: "disjunction" }),
          })}
          className="max-w-md"
        />
      </div>
    );
  }

  const orgId = workspace.id;

  // The plan, and what the shell says of it: the way to a bigger plan is offered to
  // the roles that may take it (an admin), and the chat tells the others to ask one
  const [credits, { view }] = await Promise.all([ensureMonthlyAllocation(orgId), getShell()]);
  const unlimited = credits.unlimited;
  const upgradeHref = view.quotas.find((quota) => quota.id === AI_CREDITS_QUOTA_ID)?.upgradeHref ?? null;

  const [latest] = await getConversations(user.id, orgId);
  const conversationId = latest?.id ?? null;
  const messages = conversationId ? await getMessages(conversationId) : [];
  const defaultModel = process.env.AI_DEFAULT_MODEL ?? availableModels[0]?.id ?? "gpt-4o-mini";

  // A chat belongs to its workspace: when the page is read again for another (a
  // switch made elsewhere, then the shell refreshing), it starts over from what
  // the server holds, rather than keep the other's messages. Read again for the
  // same workspace, the chat on screen stays, with an answer it is streaming:
  // its transport holds the conversation the first message started.
  return (
    <>
      <h1 className="sr-only">{t("title")}</h1>
      <Chat
        key={orgId}
        conversationId={conversationId}
        orgId={orgId}
        initialMessages={messages.map((m) => ({ role: m.role, content: m.content }))}
        availableModels={availableModels}
        defaultModel={defaultModel}
        unlimited={unlimited}
        upgradeHref={upgradeHref}
      />
    </>
  );
}
