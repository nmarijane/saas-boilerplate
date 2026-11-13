"use client";

import type { SignUpClient, SocialProvider } from "../auth-flows";
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
import { PasswordInput } from "@/shared/components/ui/password-input";
import { signUpFlow } from "../auth-flows";
import { useAuthSubmit } from "../hooks/use-auth-submit";
import { isPasswordStrong } from "../password-rules";
import { AuthConfirmation } from "./auth-confirmation";
import { PasswordStrength } from "./password-strength";
import { SocialButtons } from "./social-buttons";

interface SignUpFormProps {
  /** The auth client: the page gives none (it is the app's own), and a story gives one that answers what it is told to. */
  client?: SignUpClient;
  /** The providers the server says are on: a button for each under the form, and none when there are none. */
  socialProviders?: readonly SocialProvider[];
  /** The page that sent the person to sign up (an invitation): signing in leads back to it. */
  callbackUrl?: string;
}

// The form of the sign-up page, built as the sign-in form is (see there): it
// checks the fields itself, tells a refusal of the server in the words of the
// locale, works by loading and sends once at a time. The strength of the
// password is told as it is typed (its rules describe the field), and what is
// wrong with it only when the form is sent. Once the account exists the form
// gives way to a confirmation: the server has sent the email that verifies the
// address.
export function SignUpForm({ client = authClient, socialProviders = [], callbackUrl }: SignUpFormProps) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tSettings = useTranslations("settings");
  // The message of a refusal is a key from the root of the message files
  const tMessage = useTranslations();
  const locale = useLocale();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const rulesId = useId();
  const confirmId = useId();
  const { pending, failure, run, clearFailure } = useAuthSubmit();
  const [emailSent, setEmailSent] = useState(false);

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(1, t("errors.nameRequired")),
          email: z.email(t("errors.invalidEmail")),
          password: z.string().refine(isPasswordStrong, t("passwordTooWeak")),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          path: ["confirmPassword"],
          message: t("passwordMismatch"),
        }),
    [t],
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const passwordValue = watch("password", "");

  const onSubmit = (values: z.infer<typeof schema>) =>
    run(
      () =>
        signUpFlow(client, {
          name: values.name,
          email: values.email,
          password: values.password,
          locale,
          callbackUrl,
        }),
      () => setEmailSent(true),
    );

  if (emailSent) {
    return <AuthConfirmation message={t("emailSent")} />;
  }

  return (
    <div className="grid gap-6">
      <form
        method="post"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid gap-5"
      >
        <Field
          label={tSettings("name")}
          htmlFor={nameId}
          error={errors.name?.message}
        >
          <Input
            type="text"
            autoComplete="name"
            required
            readOnly={pending}
            className="min-h-11"
            {...register("name", { onChange: clearFailure })}
          />
        </Field>
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
        <div className="grid gap-3">
          <Field
            label={t("password")}
            htmlFor={passwordId}
            error={errors.password?.message}
          >
            <PasswordInput
              autoComplete="new-password"
              aria-describedby={passwordValue ? rulesId : undefined}
              required
              readOnly={pending}
              className="min-h-11"
              {...register("password", { onChange: clearFailure })}
            />
          </Field>
          <PasswordStrength password={passwordValue} id={rulesId} />
        </div>
        <Field
          label={t("confirmPassword")}
          htmlFor={confirmId}
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            autoComplete="new-password"
            required
            readOnly={pending}
            className="min-h-11"
            {...register("confirmPassword", { onChange: clearFailure })}
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
          {t("signUp")}
        </Button>
      </form>
      <SocialButtons providers={socialProviders} callbackUrl={callbackUrl} />
    </div>
  );
}
