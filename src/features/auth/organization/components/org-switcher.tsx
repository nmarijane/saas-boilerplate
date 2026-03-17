"use client";

import { ChevronsUpDown, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { authClient } from "@/features/auth/auth-client";
import { useSession } from "@/features/auth/hooks/use-session";
import { getUserOrganizations } from "@/features/auth/organization/queries";
import { Button } from "@/shared/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";

type Org = Awaited<ReturnType<typeof getUserOrganizations>>[number];

export function OrgSwitcher() {
  const t = useTranslations("organization");
  const { data: session } = useSession();
  const activeOrg = authClient.useActiveOrganization();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      getUserOrganizations(session.user.id).then(setOrgs);
    }
  }, [session?.user?.id]);

  const handleSwitch = async (orgId: string) => {
    await authClient.organization.setActive({ organizationId: orgId });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between">
          <span className="truncate">
            {activeOrg?.data?.name ?? t("switchOrg")}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="space-y-1">
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSwitch(org.id)}
              className="flex w-full items-center rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <span className="truncate">{org.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 border-t pt-2">
          <a
            href="/onboarding"
            className="flex w-full items-center rounded-md px-3 py-2 text-sm hover:bg-accent"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("createOrg")}
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
