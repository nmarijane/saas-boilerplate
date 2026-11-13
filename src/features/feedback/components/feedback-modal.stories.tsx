import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, fireEvent, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/shared/components/ui/button";

import { FeedbackModal } from "./feedback-modal";

const meta = {
  title: "Features/FeedbackModal",
  component: FeedbackModal,
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: () => {},
    userId: "user_123", // upload
    orgId: "org_456",
  },
  argTypes: {
    onOpenChange: { action: "onOpenChange" },
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof FeedbackModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Closed: Story = {
  args: {
    open: false,
  },
};

/**
 * Writing a message and sending it: the button waits for a message, then sends
 * it, and the dialog closes (the action is a stub that succeeds: what happens
 * when the server refuses is in the stories of the form, and in the tests).
 */
export const SendsTheFeedback: Story = {
  args: { onOpenChange: fn() },
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole("dialog", { name: "Feedback" });
    const send = within(dialog).getByRole("button", { name: "Send feedback" });

    await expect(send).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Message"), "The export button does nothing.");
    await expect(send).toBeEnabled();
    await userEvent.click(send);

    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledWith(false));
  },
};

/**
 * A stand-in for the request of the upload, which answers what a server would: a
 * story has none. The hook sends the file with an `XMLHttpRequest` to
 * `/api/upload`, and reads the status and the body of its answer.
 */
function answerUploadsWith(status: number, body: unknown) {
  return () => {
    const RealRequest = window.XMLHttpRequest;
    class AnsweringRequest {
      status = 0;
      responseText = "";
      upload = { addEventListener: () => {} };
      private listeners: Record<string, () => void> = {};
      addEventListener(type: string, listener: () => void) {
        this.listeners[type] = listener;
      }
      open() {}
      send() {
        this.status = status;
        this.responseText = JSON.stringify(body);
        queueMicrotask(() => this.listeners.load?.());
      }
    }
    window.XMLHttpRequest = AnsweringRequest as unknown as typeof XMLHttpRequest;

    return () => {
      window.XMLHttpRequest = RealRequest;
    };
  };
}

/** Picks a file in the dialog, as the person does: the input is behind the button that asks for it. */
async function pickAScreenshot(canvasElement: HTMLElement, file: File) {
  const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: /Feedback|Retour/ });
  const input = dialog.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error("The dialog has no field for a screenshot");
  }
  fireEvent.change(input, { target: { files: [file] } });

  return dialog;
}

const BIG = () => new File(["x"], "big.png", { type: "image/png" });

/**
 * A screenshot that the server refuses says why, in the dialog, where it says its
 * other errors: the message of the page's language, with the limit the server
 * gave. The answer is the 400 of `POST /api/upload`.
 */
export const RefusesAScreenshotThatIsTooLarge: Story = {
  beforeEach: answerUploadsWith(400, {
    error: "This file is too large. The maximum size is 10 MB.",
    code: "FILE_TOO_LARGE",
    status: 400,
    values: { max: 10 },
  }),
  play: async ({ canvasElement }) => {
    const dialog = await pickAScreenshot(canvasElement, BIG());

    await expect(await within(dialog).findByRole("alert")).toHaveTextContent("This file is too large. The maximum size is 10 MB.");
    // It can be tried again with another file: the button waits for nothing
    await expect(within(dialog).getByRole("button", { name: "Attach a screenshot" })).toBeEnabled();
  },
};

/** The same refusal on a page in French: the message is the French one, with the limit in Mo. */
export const RefusesAScreenshotInFrench: Story = {
  globals: { locale: "fr" },
  beforeEach: answerUploadsWith(400, {
    error: "This file is too large. The maximum size is 10 MB.",
    code: "FILE_TOO_LARGE",
    status: 400,
    values: { max: 10 },
  }),
  play: async ({ canvasElement }) => {
    const dialog = await pickAScreenshot(canvasElement, BIG());

    await expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ce fichier est trop volumineux. La taille maximale est de 10 Mo.");
    await expect(within(dialog).queryByText(/too large/)).not.toBeInTheDocument();
  },
};

/** A type that is not taken names the type, in French here. */
export const RefusesAScreenshotOfAnotherType: Story = {
  globals: { locale: "fr" },
  beforeEach: answerUploadsWith(400, {
    error: "Files of type application/x-msdownload are not accepted.",
    code: "FILE_TYPE_NOT_ALLOWED",
    status: 400,
    values: { type: "application/x-msdownload" },
  }),
  play: async ({ canvasElement }) => {
    const dialog = await pickAScreenshot(canvasElement, new File(["MZ"], "setup.exe", { type: "application/x-msdownload" }));

    await expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Les fichiers de type application/x-msdownload ne sont pas acceptés.",
    );
  },
};

/** Any other answer is the generic failure of the message files, in the language of the page: not the sentence of the server, not a status. */
export const FailsToUploadAScreenshot: Story = {
  globals: { locale: "fr" },
  beforeEach: answerUploadsWith(500, { error: "Upload failed", code: "UPLOAD_ERROR", status: 500 }),
  play: async ({ canvasElement }) => {
    const dialog = await pickAScreenshot(canvasElement, BIG());

    await expect(await within(dialog).findByRole("alert")).toHaveTextContent("Impossible de téléverser le fichier. Veuillez réessayer.");
    await expect(within(dialog).queryByText(/status 500|Upload failed/)).not.toBeInTheDocument();
  },
};

/** The dialog as the shell has it: it stays mounted when it is closed, and a button opens it again. */
function Reopenable(args: React.ComponentProps<typeof FeedbackModal>) {
  const [open, setOpen] = React.useState(args.open);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open the dialog
      </Button>
      <FeedbackModal {...args} open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * A refusal does not outlive the send. A screenshot that is refused is told in the
 * dialog; the feedback is then sent without one, and the dialog, which stays mounted
 * between its openings, shows nothing of it when it opens again: no file was picked,
 * and it must not say that one was too large.
 */
export const ForgetsARefusalOnceSent: Story = {
  render: (args) => <Reopenable {...args} />,
  beforeEach: answerUploadsWith(400, {
    error: "This file is too large. The maximum size is 10 MB.",
    code: "FILE_TOO_LARGE",
    status: 400,
    values: { max: 10 },
  }),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await pickAScreenshot(canvasElement, BIG());
    await expect(await within(dialog).findByRole("alert")).toHaveTextContent("This file is too large. The maximum size is 10 MB.");

    // The feedback is sent with no screenshot (the action is a stub that succeeds), and the dialog closes
    await userEvent.type(within(dialog).getByLabelText("Message"), "The export button does nothing.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send feedback" }));
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open the dialog" }));
    const again = await page.findByRole("dialog", { name: "Feedback" });
    await waitFor(() => expect(again).toBeVisible());
    await expect(within(again).queryByRole("alert")).not.toBeInTheDocument();
    await expect(within(again).queryByText(/too large/)).not.toBeInTheDocument();
    await expect(within(again).getByLabelText("Message")).toHaveValue("");
  },
};
