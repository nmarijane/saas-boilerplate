import { useTranslations } from "next-intl";

import { cn } from "@/shared/utils/cn";

const sizes = {
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
} as const;

interface SpinnerProps {
  /** 12, 16 (default) or 20 px. */
  size?: keyof typeof sizes;
  /**
   * What screen readers hear; defaults to the translated "Loading". Pass an
   * empty string when the text around the spinner already says it.
   */
  label?: string;
}

function Spinner({ size = "sm", label }: SpinnerProps) {
  const t = useTranslations("common");
  const text = label ?? t("loading");

  return (
    <span role={text ? "status" : undefined} className="inline-flex shrink-0">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className={cn("animate-spin motion-reduce:animate-none", sizes[size])}
      >
        <circle cx="12" cy="12" r="9" className="opacity-25" />
        <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
      </svg>
      {text ? <span className="sr-only">{text}</span> : null}
    </span>
  );
}

export { Spinner };
