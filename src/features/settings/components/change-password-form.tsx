"use client";

import type { FormEvent } from "react";
import type { PasswordClient } from "../account-flows";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { authClient } from "@/features/auth/auth-client";
import { PasswordStrength } from "@/features/auth/components/password-strength";
import { isPasswordStrong } from "@/features/auth/password-rules";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { InlineStatus } from "@/shared/components/ui/inline-status";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { PasswordInput } from "@/shared/components/ui/password-input";
import { editing } from "@/shared/utils/helpers";
import { changePasswordFlow } from "../account-flows";

interface ChangePasswordFormViewProps {
  current: string;
  next: string;
  confirm: string;
  /** The change is running: the fields wait, read-only, and so does the button. */
  pending: boolean;
  /** The last change worked: a status says so next to the button. */
  saved: boolean;
  /** The last change did not work: the fields are kept, and an alert says so. */
  failed: boolean;
  /** The new password is too weak: said under its field. It is only known once the person has tried to send it. */
  weak: boolean;
  /** The two new passwords differ: said under the second one, again once the person has tried. */
  mismatch: boolean;
  onCurrentChange: (current: string) => void;
  onNextChange: (next: string) => void;
  onConfirmChange: (confirm: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

// The three fields of a password change, as a function of the state it is given
// (as the form of a project is). The fields are read-only while the form sends,
// not disabled: a disabled field drops the focus, which a failure should find
// where it was. The strength of the new password is told as it is typed (the
// list of rules describes the field, so that they are read with it), and
// what is wrong with it only when it is sent: an error under a field that has
// just been started is a scolding. Change waits for the three fields, and shows
// that it works by loading. The error is an alert and the success a status,
// announced when they show up.
export function ChangePasswordFormView({
  current,
  next,
  confirm,
  pending,
  saved,
  failed,
  weak,
  mismatch,
  onCurrentChange,
  onNextChange,
  onConfirmChange,
  onSubmit,
}: ChangePasswordFormViewProps) {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const currentId = useId();
  const nextId = useId();
  const rulesId = useId();
  const confirmId = useId();
  const ready = current !== "" && next !== "" && confirm !== "";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Field label={t("currentPassword")} htmlFor={currentId} required>
        <PasswordInput
          value={current}
          onChange={(event) => onCurrentChange(event.target.value)}
          readOnly={pending}
          autoComplete="current-password"
          className="min-h-11"
        />
      </Field>
      <div className="grid gap-3">
        <Field
          label={t("newPassword")}
          htmlFor={nextId}
          required
          error={weak ? tAuth("passwordTooWeak") : undefined}
        >
          <PasswordInput
            value={next}
            onChange={(event) => onNextChange(event.target.value)}
            readOnly={pending}
            autoComplete="new-password"
            aria-describedby={next ? rulesId : undefined}
            className="min-h-11"
          />
        </Field>
        <PasswordStrength password={next} id={rulesId} />
      </div>
      <Field
        label={t("confirmNewPassword")}
        htmlFor={confirmId}
        required
        error={mismatch ? tAuth("passwordMismatch") : undefined}
      >
        <PasswordInput
          value={confirm}
          onChange={(event) => onConfirmChange(event.target.value)}
          readOnly={pending}
          autoComplete="new-password"
          className="min-h-11"
        />
      </Field>
      {failed ? <PageAlert tone="danger">{t("passwordFailed")}</PageAlert> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button type="submit" loading={pending} disabled={!ready}>
          {t("changePassword")}
        </Button>
        {saved ? (
          <InlineStatus state="success">{t("passwordChanged")}</InlineStatus>
        ) : null}
      </div>
    </form>
  );
}

interface ChangePasswordFormProps {
  /** The auth client: the page gives none (it is the app's own), and a story gives one that answers what it is told to. */
  client?: PasswordClient;
}

// The form that changes the password of the person. What was typed is kept when
// the change fails, so that a wrong current password is fixed, not retyped; it
// is wiped once the password has changed.
export function ChangePasswordForm({ client = authClient }: ChangePasswordFormProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const weak = attempted && !isPasswordStrong(next);
  const mismatch = attempted && next !== confirm;

  const forget = () => {
    setSaved(false);
    setFailed(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || current === "" || next === "" || confirm === "") {
      return;
    }

    setAttempted(true);
    if (!isPasswordStrong(next) || next !== confirm) {
      return;
    }

    setPending(true);
    forget();
    // A refusal and a call that fails are both answered by the alert below
    const ok = await changePasswordFlow(client, {
      currentPassword: current,
      newPassword: next,
    });
    setPending(false);

    if (ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setAttempted(false);
    }
    setSaved(ok);
    setFailed(!ok);
  };

  return (
    <ChangePasswordFormView
      current={current}
      next={next}
      confirm={confirm}
      pending={pending}
      saved={saved}
      failed={failed}
      weak={weak}
      mismatch={mismatch}
      onCurrentChange={editing(setCurrent, forget)}
      onNextChange={editing(setNext, forget)}
      onConfirmChange={editing(setConfirm, forget)}
      onSubmit={submit}
    />
  );
}
