"use client";

import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { CreateKeyModal } from "./create-key-modal";

// The one button that creates an API key, in the header of the Developers
// page, with the dialog it opens. It says that it opens a dialog, and gets the
// focus back when the dialog closes. The page draws it for the admins it is
// shown to: the server asks for the role again.
export function CreateKeyButton({ orgId }: { orgId: string }) {
  const t = useTranslations("apiKeys");
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
        <PlusIcon aria-hidden="true" />
        {t("create")}
      </Button>
      <CreateKeyModal
        orgId={orgId}
        open={open}
        onOpenChange={setOpen}
        onCloseAutoFocus={restoreFocus}
      />
    </>
  );
}
