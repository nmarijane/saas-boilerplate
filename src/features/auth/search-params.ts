/** The first value of a query parameter, which an address may repeat. */
export function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
