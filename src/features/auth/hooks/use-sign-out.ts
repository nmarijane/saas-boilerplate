"use client";

import { useTranslations } from "next-intl";
import { authClient } from "@/features/auth/auth-client";
import { toast } from "@/shared/components/ui/sonner";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { signOutAndLeave } from "../sign-out";

/**
 * Signs out: ends the session, then goes to the sign-in page (`signOutAndLeave`),
 * or to `href` (the sign-in page with a page to come back to).
 * Better Auth answers `{ data, error }` and does not throw on a refusal: the
 * refusal is raised, so that `signOutAndLeave` stops and a person who is still
 * signed in is not sent to the sign-in page, which would send them straight
 * back. It is handled with the toast, not hidden: the error reporter of the
 * app still hears it. The account menu of the shell and the header of onboarding
 * (where a person who has no workspace has no other way out) both sign out here.
 */
export function useSignOut(href?: string): () => Promise<void> {
  const tCommon = useTranslations("common");
  const router = useRouter();

  return async () => {
    try {
      await signOutAndLeave({
        signOut: async () => {
          const { error } = await authClient.signOut();
          if (error) {
            throw new Error(error.message ?? error.statusText);
          }
        },
        push: (target) => router.push(target),
        refresh: () => router.refresh(),
      }, href);
    } catch (error) {
      toast.error(tCommon("error"));
      reportHandledError(error);
    }
  };
}
