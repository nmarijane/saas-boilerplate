"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import { updateProfile } from "../actions";

const profileFormSchema = z.object({
  name: z.string().min(1).max(100),
  image: z.string().url().optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileFormProps {
  defaultValues: {
    name: string;
    email: string;
    image: string | null;
  };
}

export function ProfileForm({ defaultValues }: ProfileFormProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: defaultValues.name,
      image: defaultValues.image ?? "",
    },
  });

  async function onSubmit(data: ProfileFormValues) {
    try {
      await updateProfile(data);
      toast.success(tCommon("success"));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={defaultValues.email}
          disabled
          className="opacity-60"
        />
        <p className="text-muted-foreground text-xs">
          Email cannot be changed here.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="image">{t("avatar")}</Label>
        <Input
          id="image"
          type="url"
          placeholder="https://example.com/avatar.png"
          {...register("image")}
        />
        {errors.image && (
          <p className="text-sm text-destructive">{errors.image.message}</p>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? tCommon("loading") : tCommon("save")}
      </Button>
    </form>
  );
}
