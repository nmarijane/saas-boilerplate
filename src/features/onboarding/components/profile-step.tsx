"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/features/auth/auth-client";
import { useSession } from "@/features/auth/hooks/use-session";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

const profileSchema = z.object({
  name: z.string().min(1),
});

type ProfileValues = z.infer<typeof profileSchema>;

interface ProfileStepProps {
  onComplete: () => void;
}

export function ProfileStep({ onComplete }: ProfileStepProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { data: session } = useSession();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: session?.user?.name ?? "",
    },
  });

  const onSubmit = async (data: ProfileValues) => {
    try {
      await authClient.updateUser({ name: data.name });
      onComplete();
    } catch {
      toast.error(tCommon("error"));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? tCommon("loading") : tCommon("next")}
      </Button>
    </form>
  );
}
