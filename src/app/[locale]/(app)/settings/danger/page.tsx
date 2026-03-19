"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteAccount } from "@/features/settings/actions";
import { PageHeader } from "@/shared/components/data/page-header";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";

export default function DangerPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteAccount();
        router.push("/sign-in");
      } catch {
        toast.error(tCommon("error"));
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("dangerZone")} />

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangleIcon className="size-5" />
            {t("deleteAccount")}
          </CardTitle>
          <CardDescription>{t("deleteAccountWarning")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">{t("deleteAccount")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("deleteAccount")}</DialogTitle>
                <DialogDescription>
                  {t("deleteAccountWarning")} Type &quot;DELETE&quot; to
                  confirm.
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder='Type "DELETE" to confirm'
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    setConfirmation("");
                  }}
                  disabled={isPending}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={confirmation !== "DELETE" || isPending}
                  onClick={handleDelete}
                >
                  {isPending ? tCommon("loading") : t("deleteAccount")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
