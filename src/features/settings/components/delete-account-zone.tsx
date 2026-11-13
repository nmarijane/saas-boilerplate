"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { toast } from "@/shared/components/ui/sonner";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { deleteAccount } from "../actions";

// The last card of the account page: one sentence on the danger background, with
// a danger edge, and the one destructive button, which opens the confirmation.
// The sentence describes the button, for those who hear it. The confirmation
// cannot be dismissed while it runs, and asks for DELETE to be typed (the same
// word in every language, which the dialog names: "Type DELETE to confirm"): an
// account goes with everything the person made in it. Once the account is
// deleted the person goes to the sign-in page, where the toast says so, and the
// session they had went with the account; if it is not deleted, the dialog stays
// open with an error toast.
export function DeleteAccountZone() {
  const t = useTranslations("settings.account.delete");
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

  // It rejects when the account is still there (the server refused, or did not
  // answer), so that the dialog stays open and says so.
  const remove = async () => {
    const answer = await deleteAccount();
    if (!answer.success) {
      throw new Error(answer.error);
    }

    toast.success(t("done"));
    // Leave at once, with no await in between: the answer of the action carries
    // this page rendered again for a person who is no longer signed in, and a
    // navigation started now replaces it before it is shown.
    router.push("/sign-in");
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
        description={t("confirmDescription")}
        confirmLabel={t("button")}
        requireText="DELETE"
        onCloseAutoFocus={restoreFocus}
        onConfirm={remove}
      />
    </>
  );
}
