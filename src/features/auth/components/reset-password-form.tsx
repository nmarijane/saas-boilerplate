"use client";

import type { FormEvent } from "react";
import type { FlowMessageKey, PasswordResetClient } from "../auth-flows";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { authClient } from "@/features/auth/auth-client";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { PasswordInput } from "@/shared/components/ui/password-input";
import { TextLink } from "@/shared/components/ui/text-link";
import { Link } from "@/shared/lib/i18n-navigation";
import { editing } from "@/shared/utils/helpers";
import { resetPasswordFlow } from "../auth-flows";
import { useAuthSubmit } from "../hooks/use-auth-submit";
import { scheduleTokenRemoval } from "../reset-token";
import { AuthCard } from "./auth-card";
import { AuthConfirmation } from "./auth-confirmation";
import { PasswordStrength } from "./password-strength";

interface ResetPasswordFormViewProps {
  password: string;
  /** The reset is running: the field waits, read-only, and so does the button. */
  pending: boolean;
  /** The last send did not go through: the message to tell (a key from the root of the message files), and the password is kept. */
  failure: FlowMessageKey | null;
  /** The password has changed: a confirmation takes the place of the form. */
  done: boolean;
  onPasswordChange: (password: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

// The reset page, as a function of the state it is given (as the change-password
// form of the account page is), so that a story and a test can draw a refusal or
// a success. It draws its own card, because the card says what the form is doing:
// "Reset Password" with its sentence and a way back to sign in while the password
// is being chosen, "Password updated" with the way on once it has changed.
//
// The button is never off: a password that fails a rule is refused when the form
// is sent, as sign-up does, and told under its field (a button that is off gives a
// keyboard, and a screen reader, no word of why), with the focus sent to the
// field. The strength is told as it is typed, and its list of rules describes the
// field. Any other refusal is an alert in the words of the locale, with the way to
// ask for a new link: the usual one, as the link may have expired while the form
// was open. The button works by loading, and keeps its focus. Once the password
// has changed the form gives way to a confirmation and a link to sign in: the
// person is not signed in, they sign in with the new password.
export function ResetPasswordFormView({
  password,
  pending,
  failure,
  done,
  onPasswordChange,
  onSubmit,
}: ResetPasswordFormViewProps) {
  const t = useTranslations("auth");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");
  // The message of a refusal is a key from the root of the message files
  const tMessage = useTranslations();
  const passwordId = useId();
  const rulesId = useId();
  const field = useRef<HTMLInputElement>(null);
  // The password was refused before it was sent: that is the field's to say
  const weak = failure === "auth.passwordTooWeak";

  useEffect(() => {
    if (weak) {
      field.current?.focus();
    }
  }, [weak]);

  if (done) {
    return (
      <AuthCard title={t("passwordUpdatedTitle")}>
        <AuthConfirmation message={t("passwordUpdated")}>
          <Button asChild className="w-full">
            <Link href="/sign-in">{t("signIn")}</Link>
          </Button>
        </AuthConfirmation>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("resetPassword")}
      description={t("resetPasswordDescription")}
      footer={
        <TextLink asChild className="tap-target">
          <Link href="/sign-in">{t("backToSignIn")}</Link>
        </TextLink>
      }
    >
      <form method="post" onSubmit={onSubmit} noValidate className="grid gap-5">
        <div className="grid gap-3">
          <Field
            label={tSettings("newPassword")}
            htmlFor={passwordId}
            error={weak ? t("passwordTooWeak") : undefined}
          >
            <PasswordInput
              ref={field}
              name="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              readOnly={pending}
              autoComplete="new-password"
              aria-describedby={password ? rulesId : undefined}
              required
              className="min-h-11"
            />
          </Field>
          <PasswordStrength password={password} id={rulesId} />
        </div>
        {failure && !weak ? (
          <PageAlert
            tone="danger"
            action={
              <TextLink asChild intent="danger" className="tap-target">
                <Link href="/forgot-password">{t("requestNewLink")}</Link>
              </TextLink>
            }
          >
            {tMessage(failure)}
          </PageAlert>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          loading={pending}
          loadingText={tCommon("loading")}
        >
          {t("resetPassword")}
        </Button>
      </form>
    </AuthCard>
  );
}

interface ResetPasswordFormProps {
  /** The token of the link of the email, which Better Auth has checked and put in the address. */
  token: string;
  /** The auth client: the page gives none (it is the app's own), and a story gives one that answers what it is told to. */
  client?: Pick<PasswordResetClient, "resetPassword">;
}

// The form that sets the new password. What was typed is kept when the reset is
// refused, so that it is fixed, not retyped; it is wiped once the password has
// changed. One send at a time (useAuthSubmit); the flow refuses a password that
// is too weak, and that refusal is what the view tells under the field. The token
// is a password for an hour: the page has read it from the address and handed it
// here, where it stays in memory, and the address is replaced with one that does not
// hold it, so that it is not kept in the history or on the screen.
export function ResetPasswordForm({
  token,
  client = authClient,
}: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const { pending, failure, run, clearFailure } = useAuthSubmit();

  useEffect(() => scheduleTokenRemoval(window), []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await run(
      () => resetPasswordFlow(client, { newPassword: password, token }),
      () => {
        setPassword("");
        setDone(true);
      },
    );
  };

  return (
    <ResetPasswordFormView
      password={password}
      pending={pending}
      failure={failure}
      done={done}
      onPasswordChange={editing(setPassword, clearFailure)}
      onSubmit={submit}
    />
  );
}
