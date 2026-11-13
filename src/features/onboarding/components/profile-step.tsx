"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/features/auth/auth-client";
import { useSession } from "@/features/auth/hooks/use-session";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { toast } from "@/shared/components/ui/sonner";
import { reportHandledError } from "@/shared/utils/report-error";

interface ProfileStepProps {
  onComplete: () => void;
}

// The name the person goes by, which their teammates see. It checks the field
// itself (`noValidate`), so that what it says is in the language of the page and sits
// under the field. The field starts with the name they signed up with: the session is
// read when the step opens and may answer after the field was drawn, so it fills the
// field when it does, unless the person has started to type. Better Auth answers
// `{ data, error }` and does not throw on a refusal: the refusal is raised, and told
// with a toast.
export function ProfileStep({ onComplete }: ProfileStepProps) {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const { data: session } = useSession();
  const nameId = useId();

  const schema = useMemo(
    () => z.object({ name: z.string().trim().min(1, tAuth("errors.nameRequired")) }),
    [tAuth],
  );

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: session?.user?.name ?? "",
    },
  });

  const signedUpAs = session?.user?.name;
  useEffect(() => {
    if (signedUpAs && getValues("name") === "") {
      setValue("name", signedUpAs);
    }
  }, [signedUpAs, getValues, setValue]);

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      const { error } = await authClient.updateUser({ name: data.name });
      if (error) {
        throw new Error(error.message ?? error.statusText);
      }
      onComplete();
    } catch (error) {
      toast.error(tCommon("error"));
      reportHandledError(error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <Field label={t("name")} htmlFor={nameId} error={errors.name?.message}>
        <Input autoComplete="name" className="min-h-11" {...register("name")} />
      </Field>
      <Button
        type="submit"
        className="w-full"
        loading={isSubmitting}
        loadingText={tCommon("loading")}
      >
        {tCommon("next")}
      </Button>
    </form>
  );
}
