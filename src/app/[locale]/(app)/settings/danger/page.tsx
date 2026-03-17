"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

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
  const [confirmation, setConfirmation] = useState("");
  const [open, setOpen] = useState(false);

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
                  {t("deleteAccountWarning")} Type &quot;DELETE&quot; to confirm.
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
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={confirmation !== "DELETE"}
                >
                  {t("deleteAccount")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
