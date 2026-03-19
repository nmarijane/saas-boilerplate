import type { ReactNode } from "react";
import { isFeatureEnabled } from "../helpers";

interface FeatureGateProps {
  flag: string;
  orgId?: string;
  planId?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export async function FeatureGate({
  flag,
  orgId,
  planId,
  children,
  fallback = null,
}: FeatureGateProps) {
  const enabled = await isFeatureEnabled(flag, { orgId, planId });
  return enabled ? children : fallback;
}
