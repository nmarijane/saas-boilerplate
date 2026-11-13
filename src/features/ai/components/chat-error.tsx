"use client";

import type { ChatFailure } from "@/features/ai/chat-transport";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { Link } from "@/shared/lib/i18n-navigation";

interface ChatErrorProps {
  failure: ChatFailure;
  /**
   * Where the workspace gets a bigger plan, for the people the shell offers it
   * to (an admin); null for anyone else, who is told to ask one.
   */
  upgradeHref: string | null;
  /** Reloads the page: what a workspace that is gone or out of reach leaves to do. */
  onReload: () => void;
  /** Sends the message again. */
  onRetry: () => void;
}

// What the chat tells when its route refuses or fails, one alert with one way
// out. No credits left is a warning, and the way out is the one the shell
// offers the person: a link to the bigger plan for an admin, and for a member
// the words to ask one. A workspace that is gone or out of reach, and a message
// that got no answer, are failures: reload, or try again. The words are the
// message files', chosen by the failure: never the sentence of the server.
export function ChatError({ failure, upgradeHref, onReload, onRetry }: ChatErrorProps) {
  const t = useTranslations("ai");
  const tCommon = useTranslations("common");
  const tQuotas = useTranslations("quotas");

  if (failure === "credits") {
    return (
      <PageAlert
        tone="warning"
        title={t("errors.credits.title")}
        action={
          upgradeHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={upgradeHref}>{tQuotas("upgrade")}</Link>
            </Button>
          ) : undefined
        }
      >
        {upgradeHref ? t("errors.credits.admin") : t("errors.credits.member")}
      </PageAlert>
    );
  }

  if (failure === "gone") {
    return (
      <PageAlert
        tone="danger"
        title={t("errors.gone.title")}
        action={
          // The click event is not the business of the handler
          <Button type="button" variant="outline" size="sm" onClick={() => onReload()}>
            {t("errors.reload")}
          </Button>
        }
      >
        {t("errors.gone.description")}
      </PageAlert>
    );
  }

  return (
    <PageAlert
      tone="danger"
      title={tCommon("errorTitle")}
      action={
        <Button type="button" variant="outline" size="sm" onClick={() => onRetry()}>
          {tCommon("retry")}
        </Button>
      }
    >
      {t("errors.failed")}
    </PageAlert>
  );
}
