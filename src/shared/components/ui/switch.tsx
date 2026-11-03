"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "@/shared/utils/cn";

// A 44 by 24 px track with a 44 px hit area (`tap-target`). Off, the track is
// the control border color (3:1 against the surface); the thumb is the surface.
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer tap-target inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent",
        "transition-colors duration-150 ease-expo",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        "focus-visible:focus-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full bg-surface shadow-card transition-transform duration-150 ease-expo data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
