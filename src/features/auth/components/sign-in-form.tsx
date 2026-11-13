"use client";

import type { FlowMessageKey, SignInClient, SocialProvider } from "../auth-flows";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/features/auth/auth-client";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { PasswordInput } from "@/shared/components/ui/password-input";
import { TextLink } from "@/shared/components/ui/text-link";
import { Link, useRouter } from "@/shared/lib/i18n-navigation";
import { signInFlow } from "../auth-flows";
import { useAuthSubmit } from "../hooks/use-auth-submit";
import { signInTarget } from "../post-sign-in";
import { SocialButtons } from "./social-buttons";

interface SignInFormProps {
  /** The auth client: the page gives none (it is the app's own), and a story gives one that answers what it is told to. */
  client?: SignInClient;
  /** The providers the server says are on: a button for each under the form, and none when there are none. */
  socialProviders?: readonly SocialProvider[];
  /** The page the person asked for before they were sent here (the proxy puts it in the address): followed once they are in, if it is a page of the app. */
  callbackUrl?: string;
  /** What a provider brought the person back with when it was cancelled or refused: told in the alert from the first draw. */
  initialFailure?: FlowMessageKey | null;
}

// The form of the sign-in page. It checks the two fields itself (`noValidate`),
// so that what it says is in the language of the page and sits under the field
// it is about; a refusal of the server is an alert above the button, in the
// words of the locale (never the server's sentence). The button works by
// loading, and keeps its focus; the fields wait, read-only; one send at a time
// (useAuthSubmit). Once the server has said yes the button keeps loading until
// the page has gone: let go at once, it could be pressed again. The page is the
// one that was asked for before the redirect to this one, when it is a page of
// the app (`signInTarget`), and the dashboard otherwise. When the address is not
// verified yet, the flow sends the verification link, which comes back through
// the verify page to that same page. It posts if it is sent before the scripts
// have run: the fields would be in the address if it did not.
export function SignInForm({
  client = authClient,
  socialProviders = [],
  callbackUrl,
  initialFailure = null,
}: SignInFormProps) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  // The message of a refusal is a key from the root of the message files
  const tMessage = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const { pending, failure, run, clearFailure } = useAuthSubmit({ holdAfterSuccess: true, initialFailure });

  const schema = useMemo(
    () =>
      z.object({
        email: z.email(t("errors.invalidEmail")),
        password: z.string().min(1, t("errors.passwordRequired")),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = (values: z.infer<typeof schema>) =>
    run(
      () => signInFlow(client, { ...values, locale, callbackUrl }),
      () => {
        const target = signInTarget(callbackUrl);

        router.push(target.href, target.locale ? { locale: target.locale } : undefined);
      },
    );

  return (
    <div className="grid gap-6">
      <form
        method="post"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid gap-5"
      >
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
              autoComplete="current-password"
              required
              readOnly={pending}
              className="min-h-11"
              {...register("password", { onChange: clearFailure })}
            />
          </Field>
          <div className="flex justify-end">
            <TextLink asChild className="tap-target">
              <Link href="/forgot-password">{t("forgotPassword")}</Link>
            </TextLink>
          </div>
        </div>
        {failure ? (
          <PageAlert tone="danger">{tMessage(failure)}</PageAlert>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          loading={pending}
          loadingText={tCommon("loading")}
        >
          {t("signIn")}
        </Button>
      </form>
      <SocialButtons providers={socialProviders} callbackUrl={callbackUrl} />
    </div>
  );
}
