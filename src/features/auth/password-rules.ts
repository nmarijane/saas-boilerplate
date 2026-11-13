// The rules a new password has to meet, and what is made of them: how many it
// meets (the bars of the strength meter) and whether it meets them all (what
// sign-up, the reset and the change of password ask). A plain module: the meter,
// which is a client component, draws them, and the flows and the forms read
// them, none of which should have to take a function from a `"use client"` file.

const RE_UPPERCASE = /[A-Z]/;
const RE_LOWERCASE = /[a-z]/;
const RE_NUMBER = /\d/;
const RE_SPECIAL = /[^a-z0-9]/i;

export const PASSWORD_RULES = [
  { key: "minLength", test: (p: string) => p.length >= 8 },
  { key: "uppercase", test: (p: string) => RE_UPPERCASE.test(p) },
  { key: "lowercase", test: (p: string) => RE_LOWERCASE.test(p) },
  { key: "number", test: (p: string) => RE_NUMBER.test(p) },
  { key: "special", test: (p: string) => RE_SPECIAL.test(p) },
] as const;

export type RuleKey = (typeof PASSWORD_RULES)[number]["key"];

export function getPasswordStrength(password: string): number {
  if (!password) return 0;
  return PASSWORD_RULES.filter((rule) => rule.test(password)).length;
}

export function isPasswordStrong(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
