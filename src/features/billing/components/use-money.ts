import { useFormatter } from "next-intl";

/**
 * Writes an amount of the plans (in the major unit of the currency: 29 is 29
 * dollars) in the language of the page, as a price: "$29", "29 $US", and "$29.50"
 * only when it has cents. The currency is the one the plans are priced in
 * (`BILLING_CURRENCY`, handed down by the page): no component writes a sign or an
 * amount of its own.
 */
export function useMoney(currency: string) {
  const format = useFormatter();

  return (amount: number) =>
    format.number(amount, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    });
}
