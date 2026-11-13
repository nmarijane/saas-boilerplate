"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { deleteOrganization } from "@/features/auth/organization/actions";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { toast } from "@/shared/components/ui/sonner";
import { useRouter } from "@/shared/lib/i18n-navigation";

/** `deleteOrganization`: deletes the workspace, or answers which feature kept it. */
type DeleteWorkspace = (input: { orgId: string }) => ReturnType<typeof deleteOrganization>;

interface DeleteWorkspaceZoneProps {
  /** The workspace to delete: the page takes it from the session. */
  orgId: string;
  /** What the person has to type to confirm: the workspace is not deleted by a slip. */
  name: string;
  /**
   * Deletes the workspace on the server. The page gives nothing, and the action is
   * called; a story, which has no server (every server action is a stub that answers
   * with no data, and the answer is read here), gives one that answers by itself.
   */
  deleteWorkspace?: DeleteWorkspace;
}

// The last card of the Team page, for the owner alone (the page decides:
// `canDeleteWorkspace`; the server decides again): one sentence on the danger
// background, with a danger edge, and the one destructive button, which opens the
// confirmation. The sentence describes the button, for those who hear it. The
// confirmation cannot be dismissed while it runs, and asks for the name of the
// workspace to be typed: it takes everyone's work with it, and cancels its
// subscription. Once the workspace is deleted the person goes to the home, which
// takes the next workspace they belong to (or sends them to create one). When a
// feature could not clean up what it holds for it (the subscription could not be
// cancelled), the workspace is kept and a toast says why; when the server
// refused, or did not answer, the dialog stays open with an error toast.
export function DeleteWorkspaceZone({ orgId, name, deleteWorkspace = deleteOrganization }: DeleteWorkspaceZoneProps) {
  const t = useTranslations("organization.delete");
  // The message of a feature that kept the workspace is a key from the root of the message files
  const tMessage = useTranslations();
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

  // It rejects when the workspace is still there (the server refused, or did not
  // answer), so that the dialog stays open and says so.
  const remove = async () => {
    const answer = await deleteWorkspace({ orgId });
    if (!answer.success) {
      throw new Error(answer.error);
    }
    if (!answer.data.deleted) {
      // Explained here, not by the dialog's generic error: the workspace is still
      // there, the toast says why, and what was done already (its subscription
      // may be cancelled)
      const { messageKey, done } = answer.data;
      toast.error([messageKey, ...done].map((key) => tMessage(key)).join(" "));
      return;
    }

    toast.success(t("done"));
    // Leave at once, with no await in between: the answer of the action carries
    // this page rendered again for a workspace that is gone, and a navigation
    // started now replaces it before it is shown. The shell is read again so that
    // the switcher no longer lists the workspace.
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <>
      <Card className="border-danger bg-danger-bg">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p id={sentenceId} className="text-body text-danger-text">
            {t("description")}
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
            {t("button")}
          </Button>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        title={t("confirmTitle")}
        description={t("confirmDescription", { name })}
        confirmLabel={t("button")}
        requireText={name}
        onCloseAutoFocus={restoreFocus}
        onConfirm={remove}
      />
    </>
  );
}

export type { DeleteWorkspace };
