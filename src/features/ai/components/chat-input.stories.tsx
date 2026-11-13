import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fireEvent, fn, userEvent, within } from "storybook/test";
import { MAX_MESSAGE_LENGTH } from "../config/chat";
import { ChatInput } from "./chat-input";

// The composer of the assistant. It is controlled by the chat, so each story
// holds the text in a state of its own, as the chat does, and records what the
// chat would be told: the plays type and paste in it, press Enter and say what
// was sent, which static markup cannot.

const meta = {
  title: "Features/ChatInput",
  component: ChatInput,
  tags: ["autodocs"],
  args: {
    input: "",
    isLoading: false,
    onInputChange: fn(),
    onSubmit: fn(),
    onStop: fn(),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-lg border">
        <Story />
      </div>
    ),
  ],
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof ChatInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The composer with the text in a state of its own: what the chat does. */
function Controlled(args: React.ComponentProps<typeof ChatInput>) {
  const [input, setInput] = useState(args.input);

  return (
    <ChatInput
      {...args}
      input={input}
      onInputChange={(value) => {
        setInput(value);
        args.onInputChange(value);
      }}
    />
  );
}

/** The field of the composer, by its name. */
const fieldOf = (canvas: ReturnType<typeof within>) => canvas.getByRole("textbox", { name: "Message" });
const sendOf = (canvas: ReturnType<typeof within>) => canvas.getByRole("button", { name: "Send message" });

/** The field is named for a screen reader, sends nothing while it is empty, and sends what is written with Enter, though not with Shift and Enter. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(fieldOf(canvas)).toHaveAttribute("placeholder", "Send a message…");
    await expect(sendOf(canvas)).toBeDisabled();
    await userEvent.type(fieldOf(canvas), "{Enter}");
    await expect(args.onSubmit).not.toHaveBeenCalled();

    await userEvent.type(fieldOf(canvas), "Draft the launch email");
    await expect(sendOf(canvas)).toBeEnabled();
    await expect(canvas.getByRole("status")).toBeEmptyDOMElement();
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledOnce();
  },
};

/** Near the limit the composer shows how long the message is, and says so politely. Sending is still allowed, up to the limit. */
export const NearTheLimit: Story = {
  args: { input: "x".repeat(7_950) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("7,950 / 8,000")).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("You're close to the limit of 8,000 characters.");
    await expect(fieldOf(canvas)).not.toHaveAttribute("aria-invalid");
    await expect(sendOf(canvas)).toBeEnabled();
    await userEvent.click(fieldOf(canvas));
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledOnce();
  },
};

/** A message that is already over the limit when the composer opens: the reason is next to the field from the first draw, and the button is off. */
export const OverTheLimit: Story = {
  args: { input: "Summarize this document for the team. ".repeat(220) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("status")).toHaveTextContent("This message is over the limit of 8,000 characters. Shorten it to send it.");
    await expect(canvas.getByText("8,359 / 8,000")).toBeVisible();
    await expect(fieldOf(canvas)).toHaveAttribute("aria-invalid", "true");
    await expect(sendOf(canvas)).toBeDisabled();
  },
};

/** Typing past the limit: the count turns to an error, the reason appears next to the field, and Enter and the button refuse. */
export const TypingPastTheLimit: Story = {
  args: { input: "x".repeat(MAX_MESSAGE_LENGTH - 2) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.click(fieldOf(canvas));
    await userEvent.keyboard("{Control>}{End}{/Control}");
    await userEvent.keyboard("yy");
    await expect(canvas.getByText("8,000 / 8,000")).toBeVisible();
    await expect(sendOf(canvas)).toBeEnabled();

    await userEvent.keyboard("y");
    await expect(canvas.getByText("8,001 / 8,000")).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("This message is over the limit of 8,000 characters. Shorten it to send it.");
    await expect(fieldOf(canvas)).toHaveAttribute("aria-invalid", "true");
    await expect(sendOf(canvas)).toBeDisabled();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmit).not.toHaveBeenCalled();

    // One character less, and it is allowed again
    await userEvent.keyboard("{Backspace}");
    await expect(fieldOf(canvas)).not.toHaveAttribute("aria-invalid");
    await expect(sendOf(canvas)).toBeEnabled();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledOnce();
  },
};

/**
 * A document of 12,000 characters pasted in: the field keeps all of it (a
 * `maxLength` would keep its first 8,000 and say nothing), says it is too long,
 * and refuses to send it, by Enter and by the button. Cut to what the limit
 * takes, it goes.
 */
export const PasteOverTheLimit: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const document = "x".repeat(12_000);

    await userEvent.click(fieldOf(canvas));
    await userEvent.paste(document);

    await expect(fieldOf(canvas)).toHaveValue(document);
    await expect(fieldOf(canvas)).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByText("12,000 / 8,000")).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("This message is over the limit of 8,000 characters. Shorten it to send it.");
    await expect(canvas.getByRole("status")).toBeVisible();
    await expect(sendOf(canvas)).toBeDisabled();
    // The button is off, and takes no click (`pointer-events: none`): Enter is what is left to try
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmit).not.toHaveBeenCalled();
    // The reason is read with the field
    await expect(fieldOf(canvas)).toHaveAccessibleDescription(/12,000 \/ 8,000/);
    await expect(fieldOf(canvas)).toHaveAccessibleDescription(/over the limit/);

    // Select it all and paste a message the route takes
    await userEvent.keyboard("{Control>}a{/Control}");
    await userEvent.paste("A short one, this time.");
    await expect(fieldOf(canvas)).toHaveValue("A short one, this time.");
    await expect(fieldOf(canvas)).not.toHaveAttribute("aria-invalid");
    await expect(canvas.queryByText(/\/ 8,000/)).not.toBeInTheDocument();
    await expect(sendOf(canvas)).toBeEnabled();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledOnce();
  },
};

/** The spaces around a message are not part of it: a message that is the limit, padded, is still the limit. */
export const SpacesAroundTheLimit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(fieldOf(canvas));
    await userEvent.paste(`   ${"x".repeat(MAX_MESSAGE_LENGTH)}   `);

    await expect(canvas.getByText("8,000 / 8,000")).toBeVisible();
    await expect(fieldOf(canvas)).not.toHaveAttribute("aria-invalid");
    await expect(sendOf(canvas)).toBeEnabled();
  },
};

/** The same refusal in French, with the figures in the French format. */
export const PasteOverTheLimitInFrench: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox", { name: "Message" });

    await userEvent.click(field);
    await userEvent.paste("x".repeat(12_000));

    await expect(field).toHaveValue("x".repeat(12_000));
    await expect(canvas.getByRole("status")).toHaveTextContent(/Ce message dépasse la limite de 8\s000 caractères\. Raccourcissez-le pour l'envoyer\./);
    await expect(canvas.getByText(/12\s000 \/ 8\s000/)).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Envoyer le message" })).toBeDisabled();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/**
 * An input method (Japanese, Chinese, Korean) ends a composition with Enter: that Enter picks a
 * candidate, it does not send. Chrome and Firefox say so on the key. Safari ends the composition
 * first, and sends the Enter just after it, in the same tick, with nothing on it to say so.
 */
export const InputMethodComposition: Story = {
  args: { input: "Draft the launch email" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const field = fieldOf(canvas);

    // Chrome and Firefox: the key itself says that the input method is composing
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    await expect(args.onSubmit).not.toHaveBeenCalled();

    // Safari: the composition ends, and Enter comes in the same tick, as a plain key
    fireEvent.compositionStart(field);
    fireEvent.compositionEnd(field);
    fireEvent.keyDown(field, { key: "Enter" });
    await expect(args.onSubmit).not.toHaveBeenCalled();

    // Past that tick, Enter is the person's again
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    fireEvent.keyDown(field, { key: "Enter" });
    await expect(args.onSubmit).toHaveBeenCalledOnce();
  },
};

/** While an answer is on its way the button stops it, and Enter sends nothing more. */
export const Answering: Story = {
  args: { input: "Another question", isLoading: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
    await userEvent.click(fieldOf(canvas));
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Stop generation" }));
    await expect(args.onStop).toHaveBeenCalledOnce();
  },
};
