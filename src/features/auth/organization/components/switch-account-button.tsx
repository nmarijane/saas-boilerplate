"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSignOut } from "@/features/auth/hooks/use-sign-out";
import { Button } from "@/shared/components/ui/button";

interface SwitchAccountButtonProps {
  /** Where to sign in again: the sign-in page, with the page to come back to. */
  href: string;
}

// For a person signed in with another account than the one a page is for (an
// invitation sent to another address): ends the session, then goes to sign in
// again, and back. It works by loading, and is let go if the session could not
// be ended (the toast of `useSignOut` says so).
export function SwitchAccountButton({ href }: SwitchAccountButtonProps) {
  const t = useTranslations("invitation");
  const tCommon = useTranslations("common");
  const signOut = useSignOut(href);
  const [pending, setPending] = useState(false);

  const switchAccount = async () => {
    setPending(true);
    await signOut();
    setPending(false);
  };

  return (
    <Button
      type="button"
      className="w-full"
      loading={pending}
      loadingText={tCommon("loading")}
      onClick={() => void switchAccount()}
    >
      {t("switchAccount")}
    </Button>
  );
}
