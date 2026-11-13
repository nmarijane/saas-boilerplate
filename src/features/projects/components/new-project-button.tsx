"use client";

import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { CreateProjectDialog } from "./create-project-dialog";

// The one button that creates a project, in the header of the projects and of
// the home, with the dialog it opens. It says that it opens a dialog, and gets
// the focus back when the dialog closes.
export function NewProjectButton({ orgId }: { orgId: string }) {
  const t = useTranslations("projects");
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
        {t("new")}
      </Button>
      <CreateProjectDialog
        orgId={orgId}
        open={open}
        onOpenChange={setOpen}
        onCloseAutoFocus={restoreFocus}
      />
    </>
  );
}
