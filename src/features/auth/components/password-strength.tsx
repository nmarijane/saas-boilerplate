"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { cn } from "@/shared/utils/cn";

const RE_UPPERCASE = /[A-Z]/;
const RE_LOWERCASE = /[a-z]/;
const RE_NUMBER = /\d/;
const RE_SPECIAL = /[^a-z0-9]/i;

const PASSWORD_RULES = [
  { key: "minLength", test: (p: string) => p.length >= 8 },
  { key: "uppercase", test: (p: string) => RE_UPPERCASE.test(p) },
  { key: "lowercase", test: (p: string) => RE_LOWERCASE.test(p) },
  { key: "number", test: (p: string) => RE_NUMBER.test(p) },
  { key: "special", test: (p: string) => RE_SPECIAL.test(p) },
] as const;

type RuleKey = (typeof PASSWORD_RULES)[number]["key"];

export function getPasswordStrength(password: string): number {
  if (!password) return 0;
  return PASSWORD_RULES.filter((rule) => rule.test(password)).length;
}

export function isPasswordStrong(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

const STRENGTH_COLORS: Record<number, string> = {
  0: "bg-muted",
  1: "bg-destructive",
  2: "bg-destructive",
  3: "bg-orange-500",
  4: "bg-yellow-500",
  5: "bg-emerald-500",
};

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const t = useTranslations("auth.passwordStrength");
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const ruleResults = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        key: rule.key,
        passed: rule.test(password),
      })),
    [password]
  );

  if (!password) return null;

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < strength ? STRENGTH_COLORS[strength] : "bg-muted"
            )}
          />
        ))}
      </div>
      <ul className="space-y-1">
        {ruleResults.map(({ key, passed }) => (
          <li
            key={key}
            className={cn(
              "text-xs transition-colors",
              passed ? "text-emerald-500" : "text-muted-foreground"
            )}
          >
            {passed ? "\u2713" : "\u2022"} {t(key as RuleKey)}
          </li>
        ))}
      </ul>
    </div>
  );
}
