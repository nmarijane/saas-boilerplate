"use client";

import * as React from "react";

import { cn } from "@/shared/utils/cn";

const KEYS = ["ArrowLeft", "ArrowRight", "Home", "End"];

/**
 * The segment a key moves to: the arrows step to the neighbor and wrap around
 * the ends, Home and End jump to the first and the last. Any other key leaves
 * `index` where it is.
 */
function nextSegment(index: number, key: string, count: number): number {
  if (key === "ArrowRight") {
    return (index + 1) % count;
  }
  if (key === "ArrowLeft") {
    return (index - 1 + count) % count;
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return count - 1;
  }
  return index;
}

interface SegmentedControlProps<T extends string> {
  /** Names the group for screen readers: a legend nobody else sees. */
  label: string;
  /** `badge` is a short note after the label: "Yearly · 2 months free". */
  options: { value: T; label: string; badge?: string }[];
  value: T;
  onValueChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

// A short, exclusive choice: a billing period, a view. Each segment is a toggle
// button and a stop of the Tab key. The arrows, Home and End are a shortcut:
// they press and focus another segment, as in a group of radio buttons.
function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onValueChange,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const buttons = React.useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    // Alt and Cmd with an arrow are the browser's back and forward.
    if (
      !KEYS.includes(event.key) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();

    const next = nextSegment(index, event.key, options.length);
    const option = options[next];
    if (next !== index && option) {
      onValueChange(option.value);
      buttons.current[next]?.focus();
    }
  }

  return (
    <fieldset
      data-slot="segmented-control"
      disabled={disabled}
      className={cn(
        "inline-flex max-w-full min-w-0 gap-1 rounded-lg bg-track p-1 disabled:opacity-50",
        className,
      )}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onValueChange(option.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={cn(
            "tap-target inline-flex min-h-8 min-w-0 items-center justify-center rounded-md border border-transparent px-3 py-1 text-center text-body font-medium whitespace-normal text-ink-muted",
            "transition-[background-color,color,border-color,box-shadow] duration-150 ease-expo",
            "focus-visible:focus-ring",
            "enabled:hover:text-foreground",
            // The raised surface alone is 1.1:1 against the track: the border tells the pressed segment at 3:1.
            "aria-pressed:border-input aria-pressed:bg-surface aria-pressed:text-foreground aria-pressed:shadow-card",
            // `aria-pressed:shadow-card` comes after `focus-visible:focus-ring` and would replace the ring.
            "aria-pressed:focus-visible:focus-ring",
            "disabled:cursor-not-allowed",
          )}
        >
          {/* `relative` lifts the text above the transparent layer of `tap-target`, so a click on it lands on the text. */}
          <span className="relative">
            {option.label}
            {option.badge ? (
              <span className="font-normal">
                {" "}
                <span aria-hidden="true">·</span> {option.badge}
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </fieldset>
  );
}

export { nextSegment, SegmentedControl };
