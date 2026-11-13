"use client";

import { CoinsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCredits } from "@/features/ai/hooks/use-credits";

interface CreditBalanceProps {
  orgId: string;
  unlimited?: boolean;
}

export function CreditBalance({ orgId, unlimited }: CreditBalanceProps) {
  const t = useTranslations("ai");
  const { balance, loading } = useCredits(orgId);

  if (unlimited) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CoinsIcon className="size-4" />
        <span>{t("unlimited")}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <CoinsIcon className="size-4" />
      {loading ? (
        <span>...</span>
      ) : (
        <span>{t("credits", { count: balance ?? 0 })}</span>
      )}
    </div>
  );
}