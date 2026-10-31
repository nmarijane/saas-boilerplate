"use client";

import { useEffect, useState } from "react";
import { getOrganizationMembersAction } from "@/features/auth/organization/actions";

type Member = Awaited<ReturnType<typeof getOrganizationMembersAction>>[number];

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
    getOrganizationMembersAction(orgId)
      .then(setMembers)
      .finally(() => setIsLoading(false));
  }, [orgId]);

  const refetch = async () => {
    if (!orgId) return;
    setIsLoading(true);
    const data = await getOrganizationMembersAction(orgId);
    setMembers(data);
    setIsLoading(false);
  };

  return { members, isLoading, refetch };
}
