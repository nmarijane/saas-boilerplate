import { cn } from "@/shared/utils/cn";

// A placeholder in the hairline color. It shows on a card and on the page
// itself (1.26:1 and 1.17:1 in light mode), where the track color, 1.04:1 on
// the page, would not. It pulses, and holds still for those who ask for less
// motion.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md bg-hairline motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
