"use client";

import type {PlanConfig} from "../plans";
import { use, useCallback, useState } from "react";
import { getSubscriptionForOrg } from "../helpers";
import { getPlanById  } from "../plans";

interface SubscriptionState {
  planId: string;
  status: string;
  plan: PlanConfig | undefined;
  isLoading: boolean;
  refresh: () => void;
}

export function useSubscription(orgId: string): SubscriptionState {
  const [refreshKey, setRefreshKey] = useState(0);

  const data = use(
    getSubscriptionForOrg(orgId).then((sub) => ({
      ...sub,
      _key: refreshKey,
    }))
  );

  const plan = getPlanById(data.planId);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return {
    planId: data.planId,
    status: data.status,
    plan,
    isLoading: false,
    refresh,
  };
}
