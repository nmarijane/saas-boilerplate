"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { toast } from "@/shared/components/ui/sonner";

type ConfirmTone = "danger" | "neutral";

/** The button that confirms: red when it cannot be undone, the primary one otherwise. */
function confirmVariant(tone?: ConfirmTone): "destructive" | "default" {
  return tone === "danger" ? "destructive" : "default";
}

/**
 * The ARIA role of the dialog: a danger is announced as an alert dialog, so
 * that assistive technology reads it at once, anything else as a dialog.
 */
function confirmRole(tone?: ConfirmTone): "alertdialog" | "dialog" {
  return tone === "danger" ? "alertdialog" : "dialog";
}

interface ConfirmSteps {
  /** Tells the dialog whether the confirmation is running. */
  setPending: (pending: boolean) => void;
  close: () => void;
  /** What the error toast says when the confirmation fails, in the language of the page. */
  errorMessage: string;
}

/**
 * Runs the confirmation, and closes the dialog only once it is fulfilled. A
 * rejection leaves the dialog open and says so with an error toast. It is
 * handled, not hidden: the error reporter of the app still hears it.
 */
async function confirmThenClose(
  onConfirm: () => void | Promise<void>,
  { setPending, close, errorMessage }: ConfirmSteps,
) {
  setPending(true);
  try {
    await onConfirm();
    close();
  } catch (error) {
    toast.error(errorMessage);
    // Not defined where there is no window (a test run in Node).
    if (typeof reportError === "function") {
      reportError(error);
    }
  } finally {
    setPending(false);
  }
}

/**
 * The `onOpenChange` of the dialog while a confirmation may be running: it can
 * open, but Escape, a click outside and Cancel cannot close it until the
 * confirmation is over.
 */
function whileConfirming(
  pending: boolean,
  onOpenChange: (open: boolean) => void,
) {
  return (next: boolean) => {
    if (next || !pending) {
      onOpenChange(next);
    }
  };
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** What the confirm button says: the action itself ("Delete project"), not "OK". */
  confirmLabel: string;
  /** Defaults to the translated "Cancel". */
  cancelLabel?: string;
  /** `danger` turns the confirm button red. */
  tone?: ConfirmTone;
  /**
   * Runs when the user confirms. While a returned promise is pending the
   * button shows it and the dialog cannot be dismissed; the dialog closes once
   * the promise is fulfilled. If it rejects, the dialog stays open and an error
   * toast says so: handle a failure you can explain yourself before it gets there.
   */
  onConfirm: () => void | Promise<void>;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "neutral",
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  const [pending, setPending] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={whileConfirming(pending, onOpenChange)}>
      <DialogContent
        size="sm"
        role={confirmRole(tone)}
        showCloseButton={false}
        // Without a description, tells Radix there is none on purpose.
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <DialogHeader className="pr-0">
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              {cancelLabel ?? t("cancel")}
            </Button>
          </DialogClose>
          <Button
            variant={confirmVariant(tone)}
            loading={pending}
            onClick={() =>
              void confirmThenClose(onConfirm, {
                setPending,
                close: () => onOpenChange(false),
                errorMessage: t("error"),
              })
            }
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export {
  ConfirmDialog,
  confirmRole,
  confirmThenClose,
  confirmVariant,
  whileConfirming,
};
export type { ConfirmDialogProps, ConfirmTone };
