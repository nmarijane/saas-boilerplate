"use client";

import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/utils/cn";

interface OptionCardsProps<T extends string> {
  /** The radio buttons share it, which is what makes them a group. */
  name: string;
  options: {
    value: T;
    label: string;
    description?: string;
    icon?: LucideIcon;
  }[];
  value: T;
  onValueChange: (value: T) => void;
  /** Names the group for screen readers; leave it out when a legend already does. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

// An exclusive choice that needs a sentence per option, where a segmented
// control has room for a word. The radios are real (the arrows and Tab work as
// they do natively) and hidden: the card is their label, so the whole card is
// the target. The card, and the dot that stands for the radio, follow the
// radio's state through `has-checked` and `peer-checked`. In a Playwright test,
// click the card's text: `check()` on the hidden radio needs `{ force: true }`.
function OptionCards<T extends string>({
  name,
  options,
  value,
  onValueChange,
  label,
  disabled = false,
  className,
}: OptionCardsProps<T>) {
  const id = React.useId();

  return (
    <fieldset
      data-slot="option-cards"
      disabled={disabled}
      className={cn(
        "grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))] gap-3",
        className,
      )}
    >
      {label ? <legend className="sr-only">{label}</legend> : null}
      {options.map((option, index) => {
        const Icon = option.icon;
        const labelId = `${id}-${index}-label`;
        const descriptionId = option.description
          ? `${id}-${index}-description`
          : undefined;

        return (
          <label
            key={option.value}
            data-slot="option-card"
            // The card is the target, 44 px high at least: `tap-target` would lay a
            // transparent layer over its own text. `relative` is the box the hidden radio sits in.
            className={cn(
              "relative flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-input bg-surface p-4 text-left",
              "transition-[border-color,background-color,box-shadow] duration-150 ease-expo",
              "hover:border-ink-muted",
              "has-checked:border-primary has-checked:bg-brand-tint",
              "has-[:focus-visible]:focus-ring",
              "has-disabled:pointer-events-none has-disabled:opacity-50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onValueChange(option.value)}
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
              className="sr-only peer"
            />
            <span
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 rounded-full border border-input bg-surface transition-[background-color,border-color,box-shadow] duration-150 ease-expo peer-checked:border-primary peer-checked:bg-primary peer-checked:shadow-[inset_0_0_0_4px_var(--surface)]"
            />
            {Icon ? (
              <Icon
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-ink-muted"
              />
            ) : null}
            <span className="grid min-w-0 gap-0.5">
              <span
                id={labelId}
                className="text-body leading-5 font-medium text-foreground"
              >
                {option.label}
              </span>
              {option.description ? (
                <span id={descriptionId} className="text-meta text-ink-muted">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export { OptionCards };
