"use client";

import { CoinsIcon } from "lucide-react";
import { useCredits } from "@/features/ai/hooks/use-credits";

interface CreditBalanceProps {
  orgId: string;
  unlimited?: boolean;
}

export function CreditBalance({ orgId, unlimited }: CreditBalanceProps) {
  const { balance, loading } = useCredits(orgId);

  if (unlimited) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CoinsIcon className="size-4" />
        <span>Unlimited</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <CoinsIcon className="size-4" />
      {loading ? (
        <span>...</span>
      ) : (
        <span>{balance?.toLocaleString() ?? 0} credits</span>
      )}
    </div>
  );
}