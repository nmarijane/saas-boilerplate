import { ClockIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/shared/components/data/empty-state";

// A checkout lasts a day; one that lapsed, or that was closed, cannot be paid.
// The way out is the page that opens a new one.
export function CheckoutExpired({ href }: { href: string }) {
  const t = useTranslations("checkout");

  return <EmptyState icon={ClockIcon} headingLevel={1} title={t("expiredTitle")} description={t("expired")} action={{ label: t("expiredAction"), href }} className="mx-auto max-w-lg" />;
}
