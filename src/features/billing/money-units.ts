/**
 * An amount of the provider (an integer in the smallest unit of the currency) in
 * the major unit: cents are divided by a hundred, a currency with no minor unit
 * (the yen) is not divided at all.
 */
export function minorToMajor(minor: number, currency: string): number {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2;

  return minor / 10 ** digits;
}
