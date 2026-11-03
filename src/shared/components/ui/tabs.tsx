"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { cn } from "@/shared/utils/cn";

function Tabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

// The tabs never shrink: when they do not fit, the list scrolls sideways (the
// scrollbar is hidden: swipe, wheel and the arrow keys reach every tab). A
// scrolling box clips what sticks out of it, so its hairline is an inset
// shadow, drawn inside the box, and the active tab draws its line over it.
// Forced-colors mode drops shadows: a border keeps the baseline there.
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "flex w-full items-end gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--hairline)] forced-colors:border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...props}
    />
  );
}

// 44 px high, so the tab is its own target, and never shrunk below its label.
// The active line is in the brand color, at the bottom of the tab, and the text
// turns from muted to ink. Forced-colors mode replaces every background but a
// system color: the line takes one, as the text no longer changes there.
// The focus ring is drawn inside the tab, like the one of a menu row: the
// scrolling list would clip the system ring, a shadow outside the tab, which
// the base styles give to every button (turned off here).
function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-body font-medium whitespace-nowrap text-ink-muted",
        "transition-[color] duration-150 ease-expo hover:text-ink data-[state=active]:text-ink",
        "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand after:opacity-0 data-[state=active]:after:opacity-100 forced-colors:after:bg-[color:Highlight]",
        "focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("mt-4", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
