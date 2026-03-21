"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/features/auth/auth-client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { PasswordInput } from "@/shared/components/ui/password-input";
import { isPasswordStrong, PasswordStrength } from "./password-strength";
import { SocialButtons } from "./social-buttons";

const signUpSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8).refine(isPasswordStrong),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
  });

type SignUpValues = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tSettings = useTranslations("settings");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
  });

  const passwordValue = watch("password", "");

  const onSubmit = async (data: SignUpValues) => {
    setIsLoading(true);
    const result = await authClient.signUp.email({
      name: data.name,
      email: data.email,
      password: data.password,
    });

    if (result.error) {
      toast.error(result.error.message ?? tCommon("error"));
      setIsLoading(false);
      return;
    }

    setEmailSent(true);
    setIsLoading(false);
  };

  if (emailSent) {
    return (
      <div className="text-center space-y-4">
        <p className="text-muted-foreground">{t("emailSent")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{tSettings("name")}</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            {...register("password")}
          />
          <PasswordStrength password={passwordValue} />
          {errors.password && (
            <p className="text-sm text-destructive">
              {t("passwordTooWeak")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">
              {t("passwordMismatch")}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? tCommon("loading") : t("signUp")}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t("orContinueWith")}
          </span>
        </div>
      </div>

      <SocialButtons />

      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <a href="/sign-in" className="text-primary hover:underline">
          {t("signIn")}
        </a>
      </p>
    </div>
  );
}
