"use client";

import type { RuleKey } from "../password-rules";
import { CheckIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { cn } from "@/shared/utils/cn";
import { getPasswordStrength, PASSWORD_RULES } from "../password-rules";

// The bar takes the graphic tones of the theme (3:1 against the card, in light and
// in dark), on the track the progress bars use, and the rules that pass the text
// tone of success (4.5:1): a step of the palette is neither, and the dark theme
// cannot reach it.
const STRENGTH_COLORS: Record<number, string> = {
  0: "bg-track",
  1: "bg-destructive",
  2: "bg-destructive",
  3: "bg-warning-bar",
  4: "bg-warning-bar",
  5: "bg-success",
};

interface PasswordStrengthProps {
  password: string;
  /** The id of the list of rules: the field they are about names it in `aria-describedby`, so that the rules are read with it. */
  id?: string;
}

// One bar for each rule that passes, and the five rules under them. A rule is
// told by an icon (a check, or a cross) and by words that only assistive
// technology hears ("met", "not met"), never by its color alone: the color only
// echoes them. The bars say what the list says, so they are left to the eye.
export function PasswordStrength({ password, id }: PasswordStrengthProps) {
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
      <div aria-hidden="true" className="flex gap-1">
        {PASSWORD_RULES.map((rule, i) => (
          <div
            key={rule.key}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < strength ? STRENGTH_COLORS[strength] : "bg-track"
            )}
          />
        ))}
      </div>
      <ul id={id} className="space-y-1">
        {ruleResults.map(({ key, passed }) => {
          const Icon = passed ? CheckIcon : XIcon;

          return (
            <li
              key={key}
              className={cn(
                "flex items-center gap-2 text-meta transition-colors",
                passed ? "text-success-text" : "text-ink-muted"
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span>{t(key as RuleKey)}</span>
              <span className="sr-only">{passed ? t("met") : t("notMet")}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
