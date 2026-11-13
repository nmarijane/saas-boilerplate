"use client";

import type { PasswordResetClient } from "../auth-flows";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/features/auth/auth-client";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { requestPasswordResetFlow } from "../auth-flows";
import { useAuthSubmit } from "../hooks/use-auth-submit";
import { AuthConfirmation } from "./auth-confirmation";

interface ForgotPasswordFormProps {
  /** The auth client: the page gives none (it is the app's own), and a story gives one that answers what it is told to. */
  client?: Pick<PasswordResetClient, "requestPasswordReset">;
}

// The form that asks for the link to a new password, built as the sign-in form
// is (see there). The link leads back to the reset page in the language of this
// one. It has no link of its own: the way back to the sign-in page is the
// footer of the card the page draws, which is the same before and after the
// email has been sent.
export function ForgotPasswordForm({ client = authClient }: ForgotPasswordFormProps) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  // The message of a refusal is a key from the root of the message files
  const tMessage = useTranslations();
  const locale = useLocale();
  const emailId = useId();
  const { pending, failure, run, clearFailure } = useAuthSubmit();
  const [emailSent, setEmailSent] = useState(false);

  const schema = useMemo(
    () => z.object({ email: z.email(t("errors.invalidEmail")) }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = (values: z.infer<typeof schema>) =>
    run(
      () => requestPasswordResetFlow(client, { email: values.email, locale }),
      () => setEmailSent(true),
    );

  if (emailSent) {
    return <AuthConfirmation message={t("emailSent")} />;
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <Field
        label={t("email")}
        htmlFor={emailId}
        error={errors.email?.message}
      >
        <Input
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          required
          readOnly={pending}
          className="min-h-11"
          {...register("email", { onChange: clearFailure })}
        />
      </Field>
      {failure ? (
        <PageAlert tone="danger">{tMessage(failure)}</PageAlert>
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
  );
}
