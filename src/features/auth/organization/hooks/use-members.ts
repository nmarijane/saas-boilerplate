"use client";

import { useEffect, useState } from "react";
import { getOrganizationMembers } from "@/features/auth/organization/queries";

type Member = Awaited<ReturnType<typeof getOrganizationMembers>>[number];

export function useMembers(orgId: string | undefined) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setMembers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    getOrganizationMembers(orgId)
      .then(setMembers)
      .finally(() => setIsLoading(false));
  }, [orgId]);

  const refetch = async () => {
    if (!orgId) return;
    setIsLoading(true);
    const data = await getOrganizationMembers(orgId);
    setMembers(data);
    setIsLoading(false);
  };

  return { members, isLoading, refetch };
}
