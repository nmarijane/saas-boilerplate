"use client";

import { authClient } from "@/features/auth/auth-client";

export function useOrganization() {
  const organization = authClient.useActiveOrganization();
  return organization;
}
