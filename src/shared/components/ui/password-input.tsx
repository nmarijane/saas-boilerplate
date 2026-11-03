"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { inputVariants } from "@/shared/components/ui/input";
import { cn } from "@/shared/utils/cn";

const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => {
  const t = useTranslations("common");
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        data-slot="input"
        className={cn(inputVariants(), "pr-9", className)}
        {...props}
      />
      <button
        type="button"
        disabled={props.disabled}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        onClick={() => setVisible((v) => !v)}
        className="tap-target absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-xs text-muted-foreground transition-colors enabled:hover:text-foreground focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {visible ? (
          <EyeOffIcon className="size-4" />
        ) : (
          <EyeIcon className="size-4" />
        )}
      </button>
    </div>
  );
});

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
