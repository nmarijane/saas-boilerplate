"use client";

import { ClockIcon, LoaderIcon, TicketXIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/shared/components/data/empty-state";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { getCheckoutStatusAction } from "../actions";
import { waitForCheckout } from "../checkout-flows";

const POLL_MS = 2000;
const GIVE_UP_AFTER = 30;

// The waiting screen of a payment that was made: the app learns of it from the
// provider's webhook, a moment after the buyer is sent back. It asks the server
// every two seconds, for a minute, and goes where the answer says: the billing page
// with the news when the payment is in, the checkout again when the buyer left
// before paying, the prices when the session lapsed. A minute without the webhook is
// told as it is: the payment is made, the plan will show up, and a mail follows.
export function CheckoutReturn({ sessionId }: { sessionId: string }) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const started = useRef(false);
  const [late, setLate] = useState(false);
  const [trialSpent, setTrialSpent] = useState(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    void waitForCheckout({
      status: async () => {
        const result = await getCheckoutStatusAction({ sessionId });
        return result.success && result.data ? result.data : { state: "failed" as const };
      },
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      pollMs: POLL_MS,
      attempts: GIVE_UP_AFTER,
      go: (path) => router.replace(path),
      late: () => setLate(true),
      trialSpent: () => setTrialSpent(true),
      report: reportHandledError,
      sessionId,
    });
  }, [router, sessionId]);

  if (trialSpent) {
    return (
      <EmptyState
        icon={TicketXIcon}
        headingLevel={1}
        title={t("trialSpentTitle")}
        description={t("trialSpent")}
        action={{ label: t("trialSpentAction"), href: "/choose-plan" }}
        className="mx-auto max-w-lg"
      />
    );
  }

  if (late) {
    return (
      <EmptyState
        icon={ClockIcon}
        headingLevel={1}
        title={t("lateTitle")}
        description={t("late")}
        action={{ label: t("lateAction"), href: "/settings/billing" }}
        className="mx-auto max-w-lg"
      />
    );
  }

  return (
    <div role="status">
    <EmptyState
      icon={LoaderIcon}
      headingLevel={1}
      title={t("waitingTitle")}
      description={t("waiting")}
      className="mx-auto max-w-lg"
    />
    </div>
  );
}
