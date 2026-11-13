"use client";

import { UserPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { InviteModal } from "./invite-modal";

// The one button that invites a member, in the header of the Team page, with
// the dialog it opens. It says that it opens a dialog, and gets the focus back
// when the dialog closes. The page offers it to those who may invite
// (`canManageMembers`): the server asks for the role again.
export function InviteButton({ orgId }: { orgId: string }) {
  const t = useTranslations("organization");
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  // The dialog has no Radix `Trigger` to give the focus back to: this button does.
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    trigger.current?.focus();
  };

  return (
    <>
      <Button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <UserPlusIcon aria-hidden="true" />
        {t("invite")}
      </Button>
      <InviteModal
        orgId={orgId}
        open={open}
        onOpenChange={setOpen}
        onCloseAutoFocus={restoreFocus}
      />
    </>
  );
}
