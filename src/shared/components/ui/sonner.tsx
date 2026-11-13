"use client";

import type { ExternalToast, ToastClassnames, ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";

import { cn } from "@/shared/utils/cn";

/** How long a toast stays, in milliseconds. An error stays until it is closed. */
const TOAST_DURATION = { success: 6000, undo: 10000 } as const;

/**
 * The label of the undo action. A toast is raised from an event handler, out of
 * any component: the label reads its translation where the toast is drawn.
 */
function UndoLabel() {
  const t = useTranslations("common");

  return t("undo");
}

// The only way to raise a toast: the durations and the close button follow the
// kind of message. Options are sonner's own, and win over what is set here.
const toast = {
  success: (message: string, options?: ExternalToast) =>
    sonnerToast.success(message, {
      duration: TOAST_DURATION.success,
      ...options,
    }),
  error: (message: string, options?: ExternalToast) =>
    sonnerToast.error(message, {
      duration: Infinity,
      closeButton: true,
      ...options,
    }),
  info: (message: string, options?: ExternalToast) =>
    sonnerToast.info(message, options),
  /** Confirms an action that can be taken back, and leaves time to do it. */
  undo: (message: string, onUndo: () => void) =>
    sonnerToast.success(message, {
      duration: TOAST_DURATION.undo,
      action: { label: <UndoLabel />, onClick: () => onUndo() },
    }),
};

// A type is told by the shape of its icon, and the color echoes it. The colors
// are the graphic tokens (3:1), the ones of the status dot. Sonner defines
// `--success-text`, `--warning-bg`... on its own element, which shadows the
// theme tokens of the same name inside the toaster: nothing here may read them.
const icons = {
  success: (
    <CircleCheckIcon aria-hidden="true" className="size-5 text-success" />
  ),
  error: <CircleXIcon aria-hidden="true" className="size-5 text-danger" />,
  info: <InfoIcon aria-hidden="true" className="size-5 text-brand" />,
  warning: (
    <TriangleAlertIcon
      aria-hidden="true"
      className="size-5 text-warning-bar"
    />
  ),
  close: <XIcon aria-hidden="true" className="size-4" />,
};

// Sonner injects its own stylesheet, outside any layer: it wins over a utility.
// So the toast is `unstyled`, and sonner keeps only its position, its stack and
// its motion. The buttons sit in the line of the toast, in the order a keyboard
// reaches them: sonner draws the close button first, `order` moves it last.
const classNames = {
  toast: cn(
    // Radix turns pointer events off on the page while a modal is open.
    "pointer-events-auto flex w-(--width) items-start gap-3 rounded-lg border bg-popover p-4 font-sans text-body text-popover-foreground shadow-pop",
    // Over the faint ring of sonner on the toast itself.
    "focus-visible:focus-ring!",
    // The toasts behind the front one show their edge only.
    "data-[expanded=false]:data-[front=false]:*:opacity-0",
  ),
  icon: "flex size-5 shrink-0 items-center justify-center",
  content: "flex min-w-0 flex-1 flex-col gap-0.5",
  title: "text-body font-medium text-ink",
  description: "text-meta text-ink-muted",
  // The negative margins keep a 36 px button from making a one-line toast taller.
  actionButton:
    "tap-target order-1 -my-2 inline-flex h-9 shrink-0 items-center rounded-md px-3 text-meta font-semibold text-brand transition-colors duration-150 ease-expo hover:bg-brand-tint focus-visible:focus-ring",
  cancelButton:
    "tap-target order-1 -my-2 inline-flex h-9 shrink-0 items-center rounded-md px-3 text-meta font-semibold text-ink-muted transition-colors duration-150 ease-expo hover:text-ink focus-visible:focus-ring",
  closeButton:
    "tap-target order-last -my-1 -me-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 ease-expo hover:bg-hairline hover:text-ink focus-visible:focus-ring",
};

/** The class names of the caller join the ones above, slot by slot; the caller wins a conflict. */
function mergeClassNames(
  base: ToastClassnames,
  extra: ToastClassnames = {},
): ToastClassnames {
  const merged = { ...base };

  for (const slot of Object.keys(extra) as (keyof ToastClassnames)[]) {
    merged[slot] = cn(base[slot], extra[slot]);
  }
  return merged;
}

// The theme stays at sonner's default: its dark rules would override the tokens,
// which follow `.dark` on their own. What the caller passes joins what is set
// here (icons, toast options and their class names) instead of replacing it.
function Toaster({ icons: callerIcons, toastOptions, ...props }: ToasterProps) {
  const t = useTranslations("common");

  return (
    <Sonner
      // Whatever is neither an error nor an undo stays as long as a success.
      duration={TOAST_DURATION.success}
      containerAriaLabel={t("notifications")}
      // On a phone the shell has a tab bar, stuck to the bottom of the screen, which a toast
      // must not sit over: an error stays until it is closed, and would hide the tabs for as
      // long. The toaster is outside the shell, so it reads the height of the bar from the
      // token that the page carries (global.css), which is 0 where there is no bar: a rem
      // clear of it, as sonner leaves a rem round the screen.
      mobileOffset={{ bottom: "calc(var(--tab-bar-height, 0px) + 1rem)" }}
      {...props}
      icons={{ ...icons, ...callerIcons }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: t("close"),
        ...toastOptions,
        classNames: mergeClassNames(classNames, toastOptions?.classNames),
      }}
    />
  );
}

/** What a modal's `onInteractOutside` receives, as far as the toast guard reads it. */
interface OutsideEvent {
  target: EventTarget | null;
  preventDefault: () => void;
}

/**
 * A toast sits outside the modal it reports on. For Radix, a click on its close
 * button is a click outside: the dialog would close and the user would lose
 * what was typed. This keeps the modal open when the click lands in the toaster.
 */
function keepToastClicks(event: OutsideEvent) {
  const target = event.target as Element | null;

  if (target?.closest?.("[data-sonner-toaster]")) {
    event.preventDefault();
  }
}

/**
 * The `onInteractOutside` of a modal: the handler of the caller, if any, then
 * the toast guard. A caller that keeps the modal open itself is respected.
 */
function ignoringToasts<E extends OutsideEvent>(
  onInteractOutside?: (event: E) => void,
) {
  return (event: E) => {
    onInteractOutside?.(event);
    keepToastClicks(event);
  };
}

export { ignoringToasts, keepToastClicks, toast, TOAST_DURATION, Toaster };
