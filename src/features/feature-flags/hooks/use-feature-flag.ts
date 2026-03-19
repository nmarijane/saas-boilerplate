"use client";

import { useEffect, useState } from "react";

export function useFeatureFlag(key: string): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/features/${encodeURIComponent(key)}`)
      .then((res) => res.json())
      .then((data: { enabled: boolean }) => {
        setEnabled(data.enabled);
        setLoading(false);
      })
      .catch(() => {
        setEnabled(false);
        setLoading(false);
      });
  }, [key]);

  return { enabled, loading };
}
