"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSignOut } from "@/features/auth/hooks/use-sign-out";
import { Button } from "@/shared/components/ui/button";

// The one way out of onboarding: someone with no workspace has no shell, so no
// account menu, and the page for the account asks for a workspace. Without this the
// only thing a person who is stuck here (an owner who deleted their only workspace, a
// member who was removed, the seeded admin) could do is create one. It works by loading,
// and is let go if the session could not be ended (the toast says so).
export function SignOutButton() {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const signOut = useSignOut();
  const [pending, setPending] = useState(false);

  const leave = async () => {
    setPending(true);
    await signOut();
    setPending(false);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      loading={pending}
      loadingText={tCommon("loading")}
      onClick={() => void leave()}
    >
      <LogOutIcon aria-hidden="true" />
      {t("signOut")}
    </Button>
  );
}
