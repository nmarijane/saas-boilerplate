"use client";

import { useFormatter, useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { toast } from "@/shared/components/ui/sonner";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { cancelSubscriptionAction, resumeSubscriptionAction } from "../actions";

interface CancelZoneProps {
  orgId: string;
  planName: string;
  /** When the paid period ends: the plan is kept until then. */
  endsAt: Date | null;
}

// Where the subscription is ended. The owner's alone, and confirmed: the dialog
// says what happens (the plan is kept until the end of what is paid, then the
// workspace moves to the free plan, nothing is deleted). A cancellation is
// taken back from the alert on the top of the page while the plan is still there.
export function CancelZone({ orgId, planName, endsAt }: CancelZoneProps) {
  const t = useTranslations("billing.cancel");
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const date = endsAt ? format.dateTime(endsAt, { dateStyle: "long" }) : null;

  return (
    <Card data-slot="cancel-zone">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-section text-ink">{t("title")}</h2>
          <p className="text-body text-ink-muted">{t("description")}</p>
        </div>
        <Button type="button" variant="outline" className="shrink-0" onClick={() => setOpen(true)}>
          {t("button")}
        </Button>
      </CardContent>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        title={t("confirmTitle", { plan: planName })}
        description={date ? t("confirmDescription", { date }) : t("confirmDescriptionNoDate")}
        confirmLabel={t("confirm")}
        onConfirm={async () => {
          const result = await cancelSubscriptionAction({ orgId });
          if (!result.success) {
            throw new Error(result.error);
          }
          toast.success(t("done"));
          router.refresh();
        }}
      />
    </Card>
  );
}

// Takes a cancellation back: the plan goes on, and is charged again at its renewal.
export function ResumeButton({ orgId }: { orgId: string }) {
  const t = useTranslations("billing.cancel");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={pending}
      onClick={async () => {
        setPending(true);
        try {
          const result = await resumeSubscriptionAction({ orgId });
          if (!result.success) {
            throw new Error(result.error);
          }
          toast.success(t("resumed"));
          router.refresh();
        } catch (error) {
          unstable_rethrow(error);
          reportHandledError(error);
          toast.error(t("resumeFailed"));
        } finally {
          setPending(false);
        }
      }}
    >
      {t("resume")}
    </Button>
  );
}
