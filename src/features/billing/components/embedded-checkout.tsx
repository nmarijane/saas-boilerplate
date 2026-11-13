"use client";

import type { StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorState } from "@/shared/components/data/error-state";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";

interface EmbeddedCheckoutProps {
  /** The secret of the session: it lets the browser draw the provider's form for this session only. */
  clientSecret: string;
  /** The publishable key of the provider: public by design. */
  publishableKey: string;
  sessionId: string;
}

// The form of the provider, drawn in a card of ours. It is mounted by Stripe.js
// into a box that keeps its place while it loads (a skeleton, so that the page
// does not jump), says so when it cannot load (the script is blocked, the key
// is refused) with a button to try again, and, when the payment is made, goes to
// the return page, which waits for the app to have it. The form unmounts with the
// page.
export function EmbeddedCheckout({ clientSecret, publishableKey, sessionId }: EmbeddedCheckoutProps) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(() => {
    let checkout: StripeEmbeddedCheckout | undefined;
    let cancelled = false;

    (async () => {
      try {
        const stripe = await loadStripe(publishableKey);
        if (!stripe) {
          throw new Error("Stripe.js did not load");
        }
        const instance = await stripe.createEmbeddedCheckoutPage({
          clientSecret,
          onComplete: () => router.push(`/checkout/return?session_id=${encodeURIComponent(sessionId)}`),
        });
        if (cancelled || !box.current) {
          instance.destroy();
          return;
        }
        checkout = instance;
        instance.mount(box.current);
        setState("ready");
      } catch (error) {
        unstable_rethrow(error);
        if (!cancelled) {
          reportHandledError(error);
          setState("failed");
        }
      }
    })();

    return () => {
      cancelled = true;
      checkout?.destroy();
    };
  }, [clientSecret, publishableKey, router, sessionId]);

  useEffect(() => load(), [load, attempt]);

  if (state === "failed") {
    return (
      <ErrorState
        title={t("loadFailedTitle")}
        description={t("loadFailed")}
        onRetry={() => {
          setState("loading");
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  return (
    <Card data-slot="embedded-checkout">
      <CardContent>
        {state === "loading" ? (
          <div role="status" aria-label={t("loading")} className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-2/3" />
          </div>
        ) : null}
        <div ref={box} className={state === "loading" ? "hidden" : undefined} />
      </CardContent>
    </Card>
  );
}
