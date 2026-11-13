"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import {
  activeTab,
  tabStripStyles,
  tabStyles,
  watchActiveTab,
} from "@/shared/components/ui/tab-strip";
import { cn } from "@/shared/utils/cn";

function Tabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

// The tabs never shrink: when they do not fit, the list scrolls sideways. Its
// look is the strip it shares with TabLinks (tab-strip.ts), so that a page that
// switches in place and one that switches by route look alike.
// With more tabs than the strip holds, the one that is selected can sit out of
// sight: the list scrolls it into view when it mounts and each time the
// selection changes, however it changes. The list keeps the `ref` of the
// caller, which it shares with its own.
function TabsList({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const list = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(
    () => (list.current ? watchActiveTab(list.current, activeTab) : undefined),
    [],
  );

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      list.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  return (
    <TabsPrimitive.List
      ref={setRefs}
      data-slot="tabs-list"
      className={cn(tabStripStyles, className)}
      {...props}
    />
  );
}

// One tab, as the strip draws it (tab-strip.ts): the text turns from muted to
// ink, and the line shows, while the tab is the active one.
function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        tabStyles,
        "data-[state=active]:text-ink data-[state=active]:after:opacity-100",
        "disabled:pointer-events-none disabled:opacity-50",
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
