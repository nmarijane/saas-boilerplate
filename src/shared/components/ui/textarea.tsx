import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/shared/utils/cn";

// The look of Input (see input.tsx), with a height that follows the rows.
const textareaVariants = cva(
  [
    "flex w-full min-w-0 rounded-md border border-input bg-surface text-foreground",
    "placeholder:text-muted-foreground",
    "transition-[border-color,box-shadow] duration-150 ease-expo",
    "focus-visible:border-ring focus-visible:focus-ring",
    "aria-invalid:border-danger aria-invalid:[--focus-ring:var(--danger)]",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ],
  {
    variants: {
      size: {
        sm: "min-h-14 px-3 py-1.5 text-base md:text-meta",
        default: "min-h-16 px-3 py-2 text-base md:text-body",
        lg: "min-h-24 px-4 py-3 text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

function Textarea({
  className,
  size,
  ...props
}: React.ComponentProps<"textarea"> & VariantProps<typeof textareaVariants>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ size }), className)}
      {...props}
    />
  );
}

export { Textarea, textareaVariants };
