"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { toast } from "@/shared/components/ui/sonner";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { deleteProject } from "../actions";
import { deleteProjectFlow } from "../project-flows";

interface DeleteProjectZoneProps {
  orgId: string;
  projectId: string;
}

// The last card of the settings, for those who may delete the project (the page
// decides who: `canDeleteProject`; the server decides again): one sentence on
// the danger background, with a danger edge, and the one destructive button,
// which opens the confirmation. The sentence describes the button, for those
// who hear it. The confirmation asks nothing to be typed: it names the action
// on its button and cannot be dismissed while it runs. Once the project is
// deleted the page says so and goes back to the list; if it is not, the dialog
// stays open with an error toast.
export function DeleteProjectZone({
  orgId,
  projectId,
}: DeleteProjectZoneProps) {
  const t = useTranslations("projects");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const sentenceId = useId();

  // The confirmation has no Radix `Trigger` to give the focus back to (Cancel
  // and Escape leave the person on this page): this button does.
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    trigger.current?.focus();
  };

  return (
    <>
      <Card className="border-danger bg-danger-bg">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p id={sentenceId} className="text-body text-danger-text">
            {t("delete.description")}
          </p>
          <Button
            ref={trigger}
            type="button"
            variant="destructive"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-describedby={sentenceId}
            onClick={() => setOpen(true)}
          >
            {t("delete.button")}
          </Button>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        title={t("delete.confirmTitle")}
        description={t("delete.confirmDescription")}
        confirmLabel={t("delete.button")}
        onCloseAutoFocus={restoreFocus}
        onConfirm={() =>
          deleteProjectFlow(
            {
              remove: deleteProject,
              notify: () => toast.success(t("deleted")),
              leave: () => router.push("/projects"),
            },
            { orgId, projectId },
          )
        }
      />
    </>
  );
}
