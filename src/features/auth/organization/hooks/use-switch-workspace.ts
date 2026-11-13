"use client";

import { useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/features/auth/auth-client";
import { toast } from "@/shared/components/ui/sonner";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { switchWorkspace } from "../switch-workspace";

/**
 * Tells the session which workspace is active. Better Auth answers
 * `{ data, error }` and does not throw on a refusal, so the refusal is raised
 * here: `switchWorkspace` must stop, not go home as if the switch had worked.
 */
async function activate(organizationId: string): Promise<void> {
  const { error } = await authClient.organization.setActive({ organizationId });
  if (error) {
    throw new Error(error.message ?? error.statusText);
  }
}

/**
 * Switches to another workspace of the person: the session first, then the
 * home of the new workspace (`switchWorkspace`). `pendingId` is the workspace
 * being switched to, null when nothing runs, for the list to show it. A switch
 * that fails does not move the person and says so with a toast; it is handled,
 * not hidden, so the error reporter of the app still hears it. `switchTo`
 * never rejects: it answers whether the person was switched, for a caller that
 * has more to do when they were not (creating a workspace). It goes to the home
 * of the new workspace, or to the page it is given there (a notification of it).
 */
export function useSwitchWorkspace(): {
  switchTo: (organizationId: string, href?: string) => Promise<boolean>;
  pendingId: string | null;
} {
  const t = useTranslations("workspace");
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const switchTo = async (organizationId: string, href?: string) => {
    setPendingId(organizationId);
    try {
      await switchWorkspace(
        {
          setActive: activate,
          push: (target) => router.push(target),
          refresh: () => router.refresh(),
        },
        organizationId,
        href,
      );
      return true;
    } catch (error) {
      unstable_rethrow(error);
      toast.error(t("switchFailed"));
      reportHandledError(error);
      return false;
    } finally {
      setPendingId(null);
    }
  };

  return { switchTo, pendingId };
}
