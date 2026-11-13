"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "@/shared/components/ui/sonner";
import { usePathname, useRouter } from "@/shared/lib/i18n-navigation";

// The billing page is where a payment ends up. The page that waited for it sends
// the buyer here with `?checkout=success` (a plan) or `?checkout=credits` (a pack):
// this says it in a toast, once, and takes the parameter off the address so that a
// reload or a shared link does not say it again.
export function CheckoutReturnNotice({ checkout }: { checkout: "success" | "credits" }) {
  const t = useTranslations("billing");
  const router = useRouter();
  const pathname = usePathname();
  const told = useRef(false);

  useEffect(() => {
    if (told.current) {
      return;
    }
    told.current = true;

    toast.success(checkout === "credits" ? t("creditsAdded") : t("planActive"));
    router.replace(pathname);
  }, [checkout, pathname, router, t]);

  return null;
}
