import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/shared/utils/cn";

// The look of the text fields: Textarea and the select trigger carry the same
// classes, and forms.test.tsx keeps the three in step. Under 768 px the text is
// 16 px, as a smaller one makes iOS zoom the page on focus. When the field is
// invalid, `focus-ring` (which reads --focus-ring) turns danger along with the border.
const inputVariants = cva(
  [
    "flex w-full min-w-0 rounded-md border border-input bg-surface text-foreground",
    "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
    "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-body file:font-medium file:text-foreground",
    "transition-[border-color,box-shadow] duration-150 ease-expo",
    "focus-visible:border-ring focus-visible:focus-ring",
    "aria-invalid:border-danger aria-invalid:[--focus-ring:var(--danger)]",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ],
  {
    variants: {
      size: {
        sm: "h-9 px-3 py-1 text-base md:text-meta",
        default: "h-10 px-3 py-1 text-base md:text-body",
        lg: "h-12 px-4 py-1 text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

function Input({
  className,
  type,
  size,
  ...props
}: Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<typeof inputVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants };
