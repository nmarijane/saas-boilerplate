"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createOrganization } from "@/features/auth/organization/actions";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { slugify } from "@/shared/utils/helpers";

const orgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

type OrgValues = z.infer<typeof orgSchema>;

interface OrganizationStepProps {
  onComplete: () => void;
  onBack: () => void;
}

export function OrganizationStep({ onComplete, onBack }: OrganizationStepProps) {
  const tOrg = useTranslations("organization");
  const tCommon = useTranslations("common");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrgValues>({
    resolver: zodResolver(orgSchema),
  });

  const name = watch("name");

  useEffect(() => {
    if (name) {
      setValue("slug", slugify(name));
    }
  }, [name, setValue]);

  const onSubmit = async (data: OrgValues) => {
    const result = await createOrganization(data);
    if (result.success) {
      onComplete();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="org-name">{tOrg("name")}</Label>
        <Input id="org-name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-slug">{tOrg("slug")}</Label>
        <Input id="org-slug" {...register("slug")} />
        {errors.slug && (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          {tCommon("back")}
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? tCommon("loading") : tCommon("next")}
        </Button>
      </div>
    </form>
  );
}
