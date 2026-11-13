import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { CopyCode } from "./copy-code";

// `beforeEach` of a story: the clipboard of the page is the one the story needs
// (one that takes the text, one that refuses it, or none at all, as on a page that
// is not in a secure context), and the page gets its own back when the story ends.
function withClipboard(clipboard: { writeText: (text: string) => Promise<void> } | undefined) {
  return () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: clipboard,
    });

    return () => {
      if (original) {
        Object.defineProperty(navigator, "clipboard", original);
      } else {
        Reflect.deleteProperty(navigator, "clipboard");
      }
    };
  };
}

const writeText = fn(async () => {});

const meta = {
  title: "UI/CopyCode",
  component: CopyCode,
  tags: ["autodocs"],
  args: { value: "sb_live_Zk3V-EXAMPLE-0000-0000-0000" },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CopyCode>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The text in mono, in a box, and the one button that copies it. A click on the
 * button puts the text on the clipboard, and the button says "Copied" for a
 * moment, then goes back to "Copy".
 */
export const Default: Story = {
  beforeEach: () => {
    writeText.mockClear();
    return withClipboard({ writeText })();
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(args.value)).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Copy" }));

    await expect(writeText).toHaveBeenCalledOnce();
    await expect(writeText).toHaveBeenCalledWith(args.value);
    await expect(await canvas.findByRole("button", { name: "Copied" })).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("Copied");
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    // The moment is short: the button is the button that copies again
    await waitFor(() => expect(canvas.getByRole("button", { name: "Copy" })).toBeVisible(), { timeout: 4000 });
    await expect(canvas.getByRole("status")).toBeEmptyDOMElement();
  },
};

/** The browser refuses: the box says so in an alert, and the text is still there to be selected. */
export const Refused: Story = {
  beforeEach: withClipboard({
    writeText: async () => {
      throw new DOMException("denied", "NotAllowedError");
    },
  }),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Copy" }));

    await expect(await canvas.findByRole("alert")).toHaveTextContent("We couldn't copy it. Select the text and copy it yourself.");
    await expect(canvas.getByRole("button", { name: "Copy" })).toBeVisible();
    await expect(canvas.getByText(args.value)).toBeVisible();
  },
};

/** No clipboard at all, as on a page that is not in a secure context: the same alert. */
export const NoClipboard: Story = {
  beforeEach: withClipboard(undefined),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Copy" }));

    await expect(await canvas.findByRole("alert")).toBeVisible();
  },
};

/** A click on the text selects all of it, which is the way left when the clipboard is not. */
export const SelectsWhole: Story = {
  play: async ({ args, canvasElement }) => {
    const text = within(canvasElement).getByText(args.value);

    await expect(getComputedStyle(text).userSelect).toBe("all");
  },
};

/** The button has the focus when the box comes up in a dialog that is only about this text. */
export const Focused: Story = {
  args: { autoFocus: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Copy" })).toHaveFocus();
  },
};

/**
 * A text with no break in it wraps anywhere, so that a long key is seen whole and pushes nothing out.
 * The groups are joined by underscores, which a browser does not break at (a hyphen it does): the
 * value has no place to break but where it is cut, and is still not a run that looks like a key.
 */
export const Long: Story = {
  args: { value: `sb_whsec_${"Q9n3_Vb7X_cLz2_MfHk_".repeat(8)}` },
  play: async ({ args, canvasElement }) => {
    const code = within(canvasElement).getByText(args.value);

    await expect(code.scrollWidth).toBeLessThanOrEqual(code.clientWidth);
  },
};

export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Copier" })).toBeVisible();
  },
};
