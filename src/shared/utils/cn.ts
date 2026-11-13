import type {ClassValue} from "clsx";
import {  clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's own scale: without these names it reads
// `text-caption` as a text color and drops it next to `text-ink` (or the other
// way round). Keep the list in step with the `--text-*` tokens of global.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "caption",
        "meta",
        "body",
        "section",
        "panel",
        "entity",
        "page",
        "key",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
