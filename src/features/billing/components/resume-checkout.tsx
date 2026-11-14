"use client";

import type { BillingInterval } from "../plans";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { toast } from "@/shared/components/ui/sonner";
import { Spinner } from "@/shared/components/ui/spinner";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { continueOnFreeAction, startCheckoutAction } from "../actions";
import { chooseAnotherPlan, goToCheckout } from "../checkout-flows";

interface ResumeCheckoutProps {
  orgId: string;
  planId: string;
  interval: BillingInterval;
}

// A plan chosen before signing up is paid for as soon as there is a workspace to
// pay for it: this opens the checkout on its own, once, and says so, so that the
// person is not left wondering why the page leaves. "Choose another plan" stops
// it and clears the choice; a refusal of the server does the same and says why.
export function ResumeCheckout({ orgId, planId, interval }: ResumeCheckoutProps) {
  const t = useTranslations("chooseYourPlan");
  const tPricing = useTranslations("pricing");
  const router = useRouter();
  const started = useRef(false);
  // The person said no while the server was still answering: the answer takes them nowhere
  const refused = useRef(false);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    if (started.current || stopped) {
      return;
    }
    started.current = true;

    void goToCheckout({
      start: () => startCheckoutAction({ orgId, planId, interval }),
      // Replaces this page: going back from the payment must not land on a page that opens the payment again
      push: (path) => router.replace(path),
      // Replaces this page too: going back from the provider's page must not start the payment again
      assign: (url) => window.location.replace(url),
      fail: (code) => {
        toast.error(tPricing(`checkoutErrors.${code}`));
        setStopped(true);
      },
      report: reportHandledError,
      cancelled: () => refused.current,
    });
  }, [orgId, planId, interval, router, stopped, tPricing]);

  if (stopped) {
    return null;
  }

  return (
    <PageAlert
      tone="info"
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            refused.current = true;
            setStopped(true);
            await chooseAnotherPlan({ clear: continueOnFreeAction, go: (path) => router.replace(path), report: reportHandledError });
          }}
        >
          {t("chooseAnother")}
        </Button>
      }
    >
      <span className="flex items-center gap-2">
        <Spinner label="" />
        {t("resuming")}
      </span>
    </PageAlert>
  );
}
