"use client";

import { useCallback, useEffect, useState } from "react";
import { getCreditBalance } from "@/features/ai/queries";

export function useCredits(orgId: string) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await getCreditBalance(orgId);
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