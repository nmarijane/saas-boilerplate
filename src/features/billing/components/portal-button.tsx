"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { toast } from "@/shared/components/ui/sonner";
import { reportHandledError } from "@/shared/utils/report-error";
import { createPortalSessionAction } from "../actions";
import { openBillingPage } from "../billing-flows";

interface PortalButtonProps {
  orgId: string;
  label?: string;
  variant?: "outline" | "default" | "ghost";
  size?: "default" | "sm";
}

// Opens the customer portal of the provider, where the payment method and the
// invoices are managed: a page that is not ours, which the server asks for and
// the button goes to. A button whose page does not open says so with a toast.
export function PortalButton({ orgId, label, variant = "outline", size = "default" }: PortalButtonProps) {
  const t = useTranslations("billing");
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      loading={pending}
      loadingText={t("redirecting")}
      onClick={async () => {
        setPending(true);
        const went = await openBillingPage({
          open: () => createPortalSessionAction(orgId),
          go: (url) => window.location.assign(url),
          fail: () => toast.error(t("portalFailed")),
          report: reportHandledError,
        });
        if (!went) {
          setPending(false);
        }
      }}
    >
      {label ?? t("managePayment")}
    </Button>
  );
}
