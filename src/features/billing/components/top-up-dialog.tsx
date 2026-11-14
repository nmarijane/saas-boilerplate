"use client";

import { ZapIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { OptionCards } from "@/shared/components/ui/option-cards";
import { toast } from "@/shared/components/ui/sonner";
import { usePathname, useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { startPackCheckoutAction } from "../actions";
import { goToCheckout } from "../checkout-flows";
import { CREDIT_PACKS } from "../credit-packs";
import { useMoney } from "./use-money";

interface TopUpDialogProps {
  orgId: string;
  currency: string;
  /** The button that opens it: the page decides how loud it is (one primary button per zone). */
  variant?: "default" | "outline";
  /** Opened from outside (the chat's refusal): controlled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hides the built-in trigger, for a dialog opened from outside. */
  hideTrigger?: boolean;
  /** Opens at once: the chat's refusal sends here with `?topup=1`. */
  defaultOpen?: boolean;
}

// The packs of credits a workspace can buy on top of its plan: one-off, never
// expiring, spent after the monthly credits. One choice, one button; the payment
// opens in the checkout page like a plan's.
export function TopUpDialog({ orgId, currency, variant = "outline", open, onOpenChange, hideTrigger, defaultOpen }: TopUpDialogProps) {
  const t = useTranslations("billing.topUp");
  const tPricing = useTranslations("pricing");
  const format = useFormatter();
  const money = useMoney(currency);
  const router = useRouter();
  const pathname = usePathname();
  const [packId, setPackId] = useState(CREDIT_PACKS[0]?.id ?? "");
  const [pending, setPending] = useState(false);

  // `?topup=1` opened the packs once: a reload or a shared link does not open them again
  useEffect(() => {
    if (defaultOpen) {
      router.replace(pathname);
    }
  }, [defaultOpen, pathname, router]);

  if (CREDIT_PACKS.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button type="button" variant={variant}>
            <ZapIcon aria-hidden="true" />
            {t("trigger")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <OptionCards
          name="credit-pack"
          label={t("title")}
          value={packId}
          onValueChange={setPackId}
          options={CREDIT_PACKS.map((pack) => ({
            value: pack.id,
            label: t("pack", { credits: format.number(pack.credits) }),
            description: money(pack.price),
          }))}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            loading={pending}
            onClick={async () => {
              setPending(true);
              const went = await goToCheckout({
                start: () => startPackCheckoutAction({ orgId, packId }),
                push: (path) => router.push(path),
                assign: (url) => window.location.assign(url),
                fail: (code) => toast.error(tPricing(`checkoutErrors.${code}`)),
                report: reportHandledError,
              });
              if (!went) {
                setPending(false);
              }
            }}
          >
            {t("buy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
