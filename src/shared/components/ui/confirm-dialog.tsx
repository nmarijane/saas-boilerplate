"use client";

import { useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";

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
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { PasswordInput } from "@/shared/components/ui/password-input";
import { toast } from "@/shared/components/ui/sonner";
import { reportHandledError } from "@/shared/utils/report-error";

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
    unstable_rethrow(error);
    toast.error(errorMessage);
    reportHandledError(error);
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

/**
 * Whether what was typed unlocks the confirmation. Nothing to type (no text, or
 * an empty one) is always ready. Otherwise the text has to match as it was
 * written: case counts and a space is not dropped, as a name does not forgive
 * a slip.
 */
function confirmationReady(typed: string, requireText?: string): boolean {
  return !requireText || typed === requireText;
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
   * A text the user has to type before they can confirm: `DELETE`, or the name
   * of what is deleted. The confirm button stays disabled until the field holds
   * exactly this text. Keep it for what cannot be undone, and for what is costly
   * to get wrong.
   */
  requireText?: string;
  /**
   * Asks for the user's password before they can confirm, under this label ("Current
   * password"): for an act that a stolen session must not be able to do. The button
   * stays disabled until something is typed, and `onConfirm` is given it; the server
   * is the one that checks it.
   */
  passwordLabel?: string;
  /**
   * Runs when the user confirms. While a returned promise is pending the
   * button shows it and the dialog cannot be dismissed; the dialog closes once
   * the promise is fulfilled. If it rejects, the dialog stays open and an error
   * toast says so: handle a failure you can explain yourself before it gets there.
   */
  onConfirm: (password: string) => void | Promise<void>;
  /**
   * Called when the dialog has closed, to say where the focus goes. Radix gives
   * it back to the `Trigger` of a dialog, and this one has none (it is
   * controlled, and what opens it is a button of the page): left to Radix the
   * focus is dropped on the page body (WCAG 2.4.3). The handler gets the event
   * Radix waits on, and calls `preventDefault` on it, then focuses the opener.
   */
  onCloseAutoFocus?: (event: Event) => void;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "neutral",
  requireText,
  passwordLabel,
  onConfirm,
  onCloseAutoFocus,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  const [pending, setPending] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={whileConfirming(pending, onOpenChange)}>
      <DialogContent
        size="sm"
        role={confirmRole(tone)}
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        // Without a description, tells Radix there is none on purpose.
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <ConfirmContent
          title={title}
          description={description}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel ?? t("cancel")}
          tone={tone}
          requireText={requireText}
          passwordLabel={passwordLabel}
          pending={pending}
          onConfirm={(password) =>
            void confirmThenClose(() => onConfirm(password), {
              setPending,
              close: () => onOpenChange(false),
              errorMessage: t("error"),
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmContentProps extends Pick<
  ConfirmDialogProps,
  "title" | "description" | "confirmLabel" | "tone" | "requireText" | "passwordLabel"
> {
  cancelLabel: string;
  pending: boolean;
  onConfirm: (password: string) => void;
}

// What is in the dialog. What the user has typed lives here, with the content,
// which Radix unmounts when the dialog closes: a dialog that opens again starts
// with an empty field, however it was closed (Cancel, Escape, the page). The
// field takes none of the guesses of a keyboard (correct, capitalize, complete):
// the text is typed as it is written.
function ConfirmContent({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone,
  requireText,
  passwordLabel,
  pending,
  onConfirm,
}: ConfirmContentProps) {
  const t = useTranslations("common");
  const fieldId = React.useId();
  const passwordId = React.useId();
  const [typed, setTyped] = React.useState("");
  const [password, setPassword] = React.useState("");

  return (
    <>
      <DialogHeader className="pr-0">
        <DialogTitle>{title}</DialogTitle>
        {description ? (
          <DialogDescription>{description}</DialogDescription>
        ) : null}
      </DialogHeader>
      {requireText ? (
        <Field
          label={t("typeToConfirm", { text: requireText })}
          htmlFor={fieldId}
        >
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={pending}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
      ) : null}
      {passwordLabel ? (
        <Field label={passwordLabel} htmlFor={passwordId}>
          <PasswordInput
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            readOnly={pending}
            autoComplete="current-password"
          />
        </Field>
      ) : null}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={pending}>
            {cancelLabel}
          </Button>
        </DialogClose>
        <Button
          variant={confirmVariant(tone)}
          loading={pending}
          disabled={!confirmationReady(typed, requireText) || (passwordLabel !== undefined && password === "")}
          onClick={() => onConfirm(password)}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

export {
  confirmationReady,
  ConfirmDialog,
  confirmRole,
  confirmThenClose,
  confirmVariant,
  whileConfirming,
};
export type { ConfirmDialogProps, ConfirmTone };
