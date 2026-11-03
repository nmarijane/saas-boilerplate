"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/utils/cn";

// A 20 px box with a 44 px hit area (`tap-target`), which reaches 12 px past the
// box: stack boxes at least 12 px apart (`gap-y-3`), or the layer of the lower
// one covers the bottom of the upper one. `peer` stays, so a label next to it
// can react to its state.
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group/checkbox peer tap-target grid size-5 shrink-0 place-items-center rounded-xs border border-input bg-surface text-primary-foreground",
        "transition-[background-color,border-color,box-shadow] duration-150 ease-expo",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
        "focus-visible:focus-ring",
        "aria-invalid:border-danger aria-invalid:[--focus-ring:var(--danger)]",
        // `data-[state]:border-primary` comes later in the CSS: without these, a checked or mixed box loses its invalid border.
        "aria-invalid:data-[state=checked]:border-danger aria-invalid:data-[state=indeterminate]:border-danger",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-items-center text-current"
      >
        <CheckIcon
          strokeWidth={3}
          className="size-3.5 group-data-[state=indeterminate]/checkbox:hidden"
        />
        <MinusIcon
          strokeWidth={3}
          className="hidden size-3.5 group-data-[state=indeterminate]/checkbox:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
