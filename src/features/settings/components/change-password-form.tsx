"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/features/auth/auth-client";
import {
  isPasswordStrong,
  PasswordStrength,
} from "@/features/auth/components/password-strength";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { PasswordInput } from "@/shared/components/ui/password-input";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(1),
    confirmNewPassword: z.string().min(1),
  })
  .refine((data) => isPasswordStrong(data.newPassword), {
    path: ["newPassword"],
    message: "passwordTooWeak",
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "passwordMismatch",
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [newPasswordValue, setNewPasswordValue] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  async function onSubmit(data: ChangePasswordValues) {
    const { error } = await authClient.changePassword({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });

    if (error) {
      toast.error(error.message ?? tCommon("error"));
      return;
    }

    toast.success(t("passwordChanged"));
    reset();
    setNewPasswordValue("");
  }

  const newPasswordRegistration = register("newPassword", {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewPasswordValue(e.target.value);
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
        <PasswordInput
          id="currentPassword"
          autoComplete="current-password"
          {...register("currentPassword")}
        />
        {errors.currentPassword && (
          <p className="text-sm text-destructive">
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">{t("newPassword")}</Label>
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          {...newPasswordRegistration}
        />
        <PasswordStrength password={newPasswordValue} />
        {errors.newPassword && (
          <p className="text-sm text-destructive">
            {errors.newPassword.message === "passwordTooWeak"
              ? tAuth("passwordTooWeak")
              : errors.newPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmNewPassword">{t("confirmNewPassword")}</Label>
        <PasswordInput
          id="confirmNewPassword"
          autoComplete="new-password"
          {...register("confirmNewPassword")}
        />
        {errors.confirmNewPassword && (
          <p className="text-sm text-destructive">
            {errors.confirmNewPassword.message === "passwordMismatch"
              ? tAuth("passwordMismatch")
              : errors.confirmNewPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? tCommon("loading") : t("changePassword")}
      </Button>
    </form>
  );
}
