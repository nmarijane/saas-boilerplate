"use client";

import { useCallback, useEffect, useState } from "react";
import { getCreditBalanceAction } from "@/features/ai/actions";

export function useCredits(orgId: string) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await getCreditBalanceAction(orgId);
      setBalance(result);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balance, loading, refresh };
}