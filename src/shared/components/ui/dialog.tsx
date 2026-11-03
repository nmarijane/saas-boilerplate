"use client";

import type { VariantProps } from "class-variance-authority";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva } from "class-variance-authority";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/shared/components/ui/button";
import { ignoringToasts } from "@/shared/components/ui/sonner";
import { cn } from "@/shared/utils/cn";

// The same floating surface as a menu (see popover-styles.ts), with the dialog
// radius. Narrow screens keep a 16 px margin, and a dialog taller than the
// viewport scrolls inside it.
const dialogContentVariants = cva(
  [
    "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
    "flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-5 overflow-y-auto",
    "rounded-xl border bg-popover p-6 text-popover-foreground shadow-pop duration-200",
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  ],
  {
    variants: {
      size: {
        sm: "max-w-[420px]",
        md: "max-w-[560px]",
        lg: "max-w-[1080px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>
) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal(
  props: React.ComponentProps<typeof DialogPrimitive.Portal>
) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose(
  props: React.ComponentProps<typeof DialogPrimitive.Close>
) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-scrim",
        className
      )}
      {...props}
    />
  );
}

/** The icon button in the corner of a dialog, named in the language of the page. */
function DialogCloseButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const t = useTranslations("common");

  return (
    <DialogPrimitive.Close asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("close")}
        className={cn("absolute top-5 right-4 text-ink-muted hover:text-ink", className)}
        {...props}
      >
        <XIcon />
      </Button>
    </DialogPrimitive.Close>
  );
}

// A click on a toast is not a click outside the dialog it reports on: the toast
// closes, the dialog stays. The `onInteractOutside` of the caller still runs.
function DialogContent({
  className,
  children,
  size,
  showCloseButton = true,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof dialogContentVariants> & {
    /** The corner button: a dialog with buttons of its own (ConfirmDialog) hides it. */
    showCloseButton?: boolean;
  }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(dialogContentVariants({ size }), className)}
        onInteractOutside={ignoringToasts(onInteractOutside)}
        {...props}
      >
        {children}
        {showCloseButton ? <DialogCloseButton /> : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 pr-8 text-left", className)}
      {...props}
    />
  );
}

/** The content between the header and the footer. */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("flex flex-col gap-4 text-body", className)}
      {...props}
    />
  );
}

// At the right, the main action last. On a phone the buttons stack, and the
// main one (the last child) comes first. Wider, a row that is too short for
// long labels wraps instead of cutting a button, again with the main action
// on top.
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap-reverse sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-panel font-semibold text-ink", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-body text-ink-muted", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  dialogContentVariants,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
