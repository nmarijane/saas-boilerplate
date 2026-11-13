"use client";

import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { useId, useState } from "react";
import { createOrganization } from "@/features/auth/organization/actions";
import { Button } from "@/shared/components/ui/button";
import { whileConfirming } from "@/shared/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { createWorkspace } from "../create-workspace";
import { useSwitchWorkspace } from "../hooks/use-switch-workspace";

/** The length the server accepts for the name of a workspace, from 1 to this. */
const NAME_MAX = 100;

interface CreateWorkspaceFormProps {
  pending: boolean;
  onPendingChange: (pending: boolean) => void;
  /** The workspace exists (switched to, or listed after a refresh): nothing left to do. */
  onDone: () => void;
}

// What is in the dialog. What was typed lives here, with the content, which
// Radix unmounts when the dialog closes: a dialog that opens again starts with
// an empty field, however it was closed. Whether the creation is running lives
// outside, with the dialog, which cannot be dismissed while it is.
function CreateWorkspaceForm({
  pending,
  onPendingChange,
  onDone,
}: CreateWorkspaceFormProps) {
  const t = useTranslations("workspace");
  const tCommon = useTranslations("common");
  const { switchTo } = useSwitchWorkspace();
  const router = useRouter();
  const fieldId = useId();
  const [name, setName] = useState("");
  const [failed, setFailed] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || name.trim() === "") {
      return;
    }

    onPendingChange(true);
    setFailed(false);
    let created = false;
    try {
      created = await createWorkspace(
        {
          create: createOrganization,
          switchTo,
          refresh: () => router.refresh(),
        },
        name,
      );
    } catch (error) {
      unstable_rethrow(error);
      // Handled with the message below, not hidden: the error reporter of the
      // app still hears it.
      reportHandledError(error);
    } finally {
      onPendingChange(false);
    }

    if (created) {
      onDone();
    } else {
      setFailed(true);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("create")}</DialogTitle>
        <DialogDescription>{t("createDescription")}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Field
          label={t("nameLabel")}
          htmlFor={fieldId}
          required
          error={failed ? t("createFailed") : undefined}
        >
          {/* read-only while it runs, not disabled: a disabled field drops the focus, which a failure should find where it was */}
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setFailed(false);
            }}
            maxLength={NAME_MAX}
            readOnly={pending}
            autoComplete="off"
            className="min-h-11"
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            {tCommon("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" loading={pending} disabled={name.trim() === ""}>
          {tCommon("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the dialog has closed, to say where the focus goes. Radix gives
   * it back to the `Trigger` of a dialog, and this one has none (what opens it
   * is a row of a popover, or a button, a long way from it in the markup): left
   * to Radix the focus is dropped on the page body (WCAG 2.4.3). The
   * handler gets the event Radix waits on, and calls `preventDefault` on it.
   */
  onCloseAutoFocus?: (event: Event) => void;
}

// The dialog that creates a workspace and switches to it: the name is all it
// asks, as the address is made from it (workspaceSlug). It closes once the
// workspace exists, and a failure to create it stays in the field, where the
// person can fix the name or try again.
export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: CreateWorkspaceDialogProps) {
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={whileConfirming(pending, onOpenChange)}>
      <DialogContent size="sm" onCloseAutoFocus={onCloseAutoFocus}>
        <CreateWorkspaceForm
          pending={pending}
          onPendingChange={setPending}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
