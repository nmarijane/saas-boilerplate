import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FeedbackForm } from "./feedback-form";

// The fields of the feedback dialog, in each state its form can be in. The
// dialog draws them over a state of its own (feedback-form-state.ts): here the
// state is given, so that the state of a refused send can be seen, which no
// story of the dialog can show: Storybook has no server to refuse it.

const meta = {
  title: "Features/FeedbackForm",
  component: FeedbackForm,
  args: {
    form: {
      type: "bug",
      message: "The export button does nothing when I press it.",
      sending: false,
      failed: false,
    },
    onTypeChange: fn(),
    onMessageChange: fn(),
    onSend: fn(),
  },
  argTypes: { form: { control: "object" } },
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[28rem] max-w-full rounded-xl border bg-popover p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FeedbackForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** At rest, with a message written: the button sends it. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const send = within(canvasElement).getByRole("button", { name: "Send feedback" });

    await userEvent.click(send);

    await expect(args.onSend).toHaveBeenCalledOnce();
    // With nothing: the click event is not its business.
    await expect(args.onSend).toHaveBeenCalledWith();
  },
};

/** Nothing written yet: the button waits for a message. */
export const Empty: Story = {
  args: { form: { type: "bug", message: "", sending: false, failed: false } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Send feedback" })).toBeDisabled();
  },
};

/**
 * While the feedback is sent the button is loading, not disabled: it keeps its
 * label ("Sending…"), shows a spinner, and does nothing when it is pressed
 * again.
 */
export const Sending: Story = {
  args: { form: { type: "bug", message: "The export button does nothing.", sending: true, failed: false } },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: /Sending/ });

    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).not.toBeDisabled();
    await userEvent.click(button);
    await expect(args.onSend).not.toHaveBeenCalled();
  },
};

/**
 * The server refused the feedback: the message is kept in its field, an alert
 * says so above the button, and the button is back, ready for another try.
 */
export const Failed: Story = {
  args: { form: { type: "bug", message: "The export button does nothing when I press it.", sending: false, failed: true } },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toHaveTextContent("We couldn't send your feedback. Please try again.");
    await expect(canvas.getByLabelText("Message")).toHaveValue("The export button does nothing when I press it.");

    await userEvent.click(canvas.getByRole("button", { name: "Send feedback" }));
    await expect(args.onSend).toHaveBeenCalledOnce();
  },
};

/** The message stops at 5,000 characters, the length the server accepts. */
export const StopsAtTheLengthTheServerAccepts: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText("Message")).toHaveAttribute("maxlength", "5000");
  },
};

/** Writing and choosing call back with what was written and chosen. */
export const Edits: Story = {
  args: { form: { type: "bug", message: "", sending: false, failed: false } },
  play: async ({ args, canvasElement }) => {
    await userEvent.type(within(canvasElement).getByLabelText("Message"), "Hi");

    await expect(args.onMessageChange).toHaveBeenLastCalledWith("i");
  },
};

/** The same state, in French. */
export const French: Story = {
  args: { form: { type: "feature", message: "Un mode sombre, s'il vous plaît.", sending: false, failed: true } },
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toHaveTextContent("Impossible d'envoyer votre feedback. Veuillez réessayer.");
    await expect(canvas.getByRole("button", { name: "Envoyer un feedback" })).toBeVisible();
  },
};
