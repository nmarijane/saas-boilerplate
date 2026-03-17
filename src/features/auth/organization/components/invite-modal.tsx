"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { inviteMember } from "@/features/auth/organization/actions";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

const inviteFormSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>;

interface InviteModalProps {
  orgId: string;
  onInvited?: () => void;
}

export function InviteModal({ orgId, onInvited }: InviteModalProps) {
  const t = useTranslations("organization");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { role: "member" },
  });

  const onSubmit = async (data: InviteFormValues) => {
    setIsLoading(true);
    try {
      await inviteMember({ orgId, email: data.email, role: data.role });
      toast.success(tCommon("success"));
      reset();
      setOpen(false);
      onInvited?.();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("invite")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("invite")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">{tAuth("email")}</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("role")}</Label>
            <Select
              defaultValue="member"
              onValueChange={(value) =>
                setValue("role", value as "admin" | "member")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{t("admin")}</SelectItem>
                <SelectItem value="member">{t("member")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? tCommon("loading") : tCommon("submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
