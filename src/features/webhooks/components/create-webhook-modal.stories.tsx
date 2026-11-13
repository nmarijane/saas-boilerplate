import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent } from "@/shared/components/ui/dialog";
import { AVAILABLE_EVENTS } from "../available-events";
import {
  CreatedEndpointView,
  CreateEndpointFormView,
  CreateWebhookModal,
} from "./create-webhook-modal";

// The dialog that adds a webhook endpoint. The server action it calls is replaced
// by `create`, which answers by itself: a story has no server, and Storybook's
// stub of a server action answers with no data, which is not a secret. What a
// refusal and a wait look like is shown here too, by a `create` that fails and
// by one that waits.

const SECRET = "sb_whsec_Q9n3-EXAMPLE-0000-0000-0000";

/** `beforeEach` of a story: the errors the app reports (`reportError`) are taken away from the page, for a story that fails on purpose. */
const reported = fn();
function catchReports() {
  reported.mockClear();
  const original = window.reportError;
  window.reportError = reported;

  return () => {
    window.reportError = original;
  };
}

/** A dialog that is open when the story loads; its trigger opens it again once closed. */
function Example({
  open: initialOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof CreateWebhookModal>) {
  const [open, setOpen] = React.useState(initialOpen);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open the dialog
      </Button>
      <CreateWebhookModal
        {...props}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange(next);
        }}
      />
    </>
  );
}

/** The dialog, in its place on the page: the body, where Radix draws it. */
async function findDialog(canvasElement: HTMLElement, name: string) {
  const page = within(canvasElement.ownerDocument.body);
  const dialog = await page.findByRole("dialog", { name });
  // The dialog fades in: it is in the page before it can be seen.
  await waitFor(() => expect(dialog).toBeVisible());

  return { page, dialog };
}

/**
 * The overlay is what a click beside the dialog lands on, and Radix turns the
 * pointer events of the page itself off while a dialog is open.
 */
function overlayOf(canvasElement: HTMLElement): HTMLElement {
  return canvasElement.ownerDocument.querySelector('[data-slot="dialog-overlay"]') as HTMLElement;
}

const meta = {
  title: "Features/CreateWebhookModal",
  component: CreateWebhookModal,
  args: {
    orgId: "org_1",
    open: true,
    onOpenChange: () => {},
    create: fn(async () => ({ id: "e1", secret: SECRET })),
  },
  argTypes: { onOpenChange: { action: "onOpenChange" } },
  parameters: {
    layout: "centered",
    // The dialog reads the page again through the router of the app, once the
    // endpoint exists: Storybook has none, and mounts a stand-in for the stories
    // that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/settings/developers" } },
    // While a dialog is open, Radix hides the page (the trigger included) from
    // assistive technology and traps the focus in the dialog: the trigger
    // cannot be reached, which axe cannot tell.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<typeof CreateWebhookModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An address and an event are all it needs: the address has the focus, every
 * event is offered as a labelled box (the events of the projects last), and "Add
 * endpoint" waits for the two. No box is ticked to start with.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Add endpoint");
    const url = within(dialog).getByLabelText(/Endpoint URL/);
    const add = within(dialog).getByRole("button", { name: "Add endpoint" });
    const boxes = within(dialog).getAllByRole("checkbox");

    await expect(url).toHaveFocus();
    await expect(add).toBeDisabled();
    await expect(within(dialog).getByRole("group", { name: "Events" })).toBeVisible();
    await expect(boxes).toHaveLength(AVAILABLE_EVENTS.length);
    await expect(boxes.every((box) => box.getAttribute("aria-checked") === "false")).toBe(true);
    await expect(boxes.slice(-3).map((box) => box.closest("label")?.textContent?.trim())).toEqual(["Project created", "Project updated", "Project deleted"]);

    await userEvent.type(url, "https://example.com/hooks");
    await expect(add).toBeDisabled();

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Member invited" }));
    await expect(add).toBeEnabled();
    await expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  },
};

/**
 * The endpoint is added with what was typed, and then the dialog tells its
 * signing secret, once: in mono, with the sentence that says it will not be shown
 * again, the button that copies it (it has the focus) and Done. Done closes the
 * dialog, and the secret is gone for good: the dialog that opens again is empty.
 */
export const AddsAnEndpoint: Story = {
  play: async ({ args, canvasElement }) => {
    const { page, dialog } = await findDialog(canvasElement, "Add endpoint");

    await userEvent.type(within(dialog).getByLabelText(/Endpoint URL/), "  https://example.com/hooks ");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Member invited" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Project deleted" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add endpoint" }));

    const created = await page.findByRole("dialog", { name: "Endpoint added" });
    await expect(args.create).toHaveBeenCalledOnce();
    await expect(args.create).toHaveBeenCalledWith("org_1", {
      url: "https://example.com/hooks",
      events: ["member.invited", "project.deleted"],
    });
    await waitFor(() => expect(within(created).getByText(SECRET)).toBeVisible());
    await expect(created).toHaveAccessibleDescription("Copy your signing secret now. You won't be able to see it again.");
    await expect(within(created).getByRole("button", { name: "Copy" })).toHaveFocus();
    await expect(within(created).queryByRole("textbox")).not.toBeInTheDocument();

    await userEvent.click(within(created).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open the dialog" }));
    const again = await page.findByRole("dialog", { name: "Add endpoint" });
    await expect(within(again).getByLabelText(/Endpoint URL/)).toHaveValue("");
    await expect(within(again).getByRole("checkbox", { name: "Member invited" })).not.toBeChecked();
    await expect(page.queryByText(SECRET)).not.toBeInTheDocument();
  },
};

/**
 * While the secret is on screen a click beside the dialog does nothing: it would
 * discard a secret that cannot be shown again, with no warning. The dialog is not
 * even asked to close. Escape closes it, as it is meant to: that is a choice.
 */
export const OutsideClickKeepsTheSecret: Story = {
  args: { onOpenChange: fn() },
  play: async ({ args, canvasElement }) => {
    const { page, dialog } = await findDialog(canvasElement, "Add endpoint");

    await userEvent.type(within(dialog).getByLabelText(/Endpoint URL/), "https://example.com/hooks");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Member invited" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add endpoint" }));
    const created = await page.findByRole("dialog", { name: "Endpoint added" });
    await waitFor(() => expect(within(created).getByText(SECRET)).toBeVisible());

    await userEvent.click(overlayOf(canvasElement));

    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(page.getByRole("dialog", { name: "Endpoint added" })).toBeVisible();
    await expect(page.getByText(SECRET)).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

/** The form is not the secret: a click beside it closes it, as it always did. Only the screen that tells the secret is guarded. */
export const OutsideClickClosesTheForm: Story = {
  args: { onOpenChange: fn() },
  play: async ({ args, canvasElement }) => {
    const { page } = await findDialog(canvasElement, "Add endpoint");

    await userEvent.click(overlayOf(canvasElement));

    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

/** Closing some other way than Done leaves no secret behind either: Escape on the screen that tells it. */
export const SecretIsNotKept: Story = {
  play: async ({ canvasElement }) => {
    const { page, dialog } = await findDialog(canvasElement, "Add endpoint");

    await userEvent.type(within(dialog).getByLabelText(/Endpoint URL/), "https://example.com/hooks");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Member invited" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add endpoint" }));
    await waitFor(async () => expect(await page.findByText(SECRET)).toBeVisible());

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open the dialog" }));
    const again = await page.findByRole("dialog", { name: "Add endpoint" });
    await expect(within(again).getByLabelText(/Endpoint URL/)).toHaveValue("");
    await expect(page.queryByText(SECRET)).not.toBeInTheDocument();
  },
};

/**
 * An address that is not a web address is said under the field, as an alert tied
 * to it, and nothing is sent. Typing again is another try: the message goes.
 */
export const RefusesABadAddress: Story = {
  play: async ({ args, canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Add endpoint");
    const url = within(dialog).getByLabelText(/Endpoint URL/);

    await userEvent.type(url, "example.com");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Member invited" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add endpoint" }));

    await expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter a full https address, such as https://example.com/webhooks.");
    await expect(url).toHaveAttribute("aria-invalid", "true");
    await expect(url).toHaveValue("example.com");
    await expect(args.create).not.toHaveBeenCalled();

    await userEvent.type(url, "/hooks");
    await expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  },
};

// An addition that does not come back until the story says so.
const gate = { release: (_answer: { id: string; secret: string }) => {} };

/**
 * While the endpoint is being added the dialog waits: Add shows that it works and
 * keeps the focus, a second press does nothing (the server is asked once), the
 * fields and the buttons are held, and neither Escape nor a click outside closes
 * the dialog: an endpoint added while it is gone would be one whose secret nobody
 * has seen.
 */
export const WaitsForTheServer: Story = {
  args: {
    // A spy of its own, to say that the dialog was never asked to close
    onOpenChange: fn(),
    create: fn(
      () =>
        new Promise<{ id: string; secret: string }>((resolve) => {
          gate.release = resolve;
        }),
    ),
  },
  play: async ({ args, canvasElement }) => {
    const { page, dialog } = await findDialog(canvasElement, "Add endpoint");
    const url = within(dialog).getByLabelText(/Endpoint URL/);

    await userEvent.type(url, "https://example.com/hooks");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Member invited" }));
    const add = within(dialog).getByRole("button", { name: "Add endpoint" });
    await userEvent.dblClick(add);

    await waitFor(() => expect(add).toHaveAttribute("aria-disabled", "true"));
    await expect(add).not.toBeDisabled();
    await expect(args.create).toHaveBeenCalledOnce();
    await expect(url).toHaveAttribute("readonly");
    await expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();

    await userEvent.keyboard("{Escape}");
    // A click outside is a click on the overlay: Radix turns the pointer events of the page itself off
    await userEvent.click(canvasElement.ownerDocument.querySelector('[data-slot="dialog-overlay"]') as HTMLElement);
    // The dialog is asked to close by neither, and is still there: it fades out when it does close, so that it would
    // be on the page a moment after being asked
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(page.getByRole("dialog", { name: "Add endpoint" })).toBeVisible();

    gate.release({ id: "e1", secret: SECRET });
    await expect(await page.findByRole("dialog", { name: "Endpoint added" })).toBeVisible();
    await expect(args.create).toHaveBeenCalledOnce();
  },
};

/** The server refuses, or does not answer: what was typed is kept, the dialog says so with an alert, and Add can be pressed again. */
export const Fails: Story = {
  args: {
    create: fn(async () => {
      throw new Error("offline");
    }),
  },
  beforeEach: catchReports,
  play: async ({ args, canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Add endpoint");
    const url = within(dialog).getByLabelText(/Endpoint URL/);

    await userEvent.type(url, "https://example.com/hooks");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Member invited" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add endpoint" }));

    await expect(await within(dialog).findByRole("alert")).toHaveTextContent("We couldn't add the endpoint. Please try again.");
    await expect(args.create).toHaveBeenCalledOnce();
    await expect(reported).toHaveBeenCalledOnce();
    await expect(url).toHaveValue("https://example.com/hooks");
    await expect(within(dialog).getByRole("checkbox", { name: "Member invited" })).toBeChecked();
    await expect(within(dialog).getByRole("button", { name: "Add endpoint" })).toBeEnabled();

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Member removed" }));
    await expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  },
};

/** Cancel closes the dialog, and an empty dialog is what opens again. */
export const Cancels: Story = {
  play: async ({ args, canvasElement }) => {
    const { page, dialog } = await findDialog(canvasElement, "Add endpoint");

    await userEvent.type(within(dialog).getByLabelText(/Endpoint URL/), "https://example.com/hooks");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.create).not.toHaveBeenCalled();

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open the dialog" }));
    const again = await page.findByRole("dialog", { name: "Add endpoint" });
    await expect(within(again).getByLabelText(/Endpoint URL/)).toHaveValue("");
  },
};

/** The same dialog in French, the events included. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Ajouter un endpoint");

    await expect(within(dialog).getByLabelText(/URL de l'endpoint/)).toHaveFocus();
    await expect(within(dialog).getByRole("group", { name: "Événements" })).toBeVisible();
    await expect(within(dialog).getByRole("checkbox", { name: "Membre invité" })).toBeVisible();
    await expect(within(dialog).getByRole("checkbox", { name: "Projet supprimé" })).toBeVisible();
    await expect(within(dialog).getByRole("button", { name: "Ajouter l'endpoint" })).toBeDisabled();
  },
};

// The views of the dialog, in the dialog they live in, for what `create` cannot show as it stands.
type FormProps = React.ComponentProps<typeof CreateEndpointFormView>;

function ViewInDialog({ children }: { children: React.ReactNode }) {
  return (
    <Dialog open>
      <DialogContent>{children}</DialogContent>
    </Dialog>
  );
}

function FormInDialog(props: Partial<FormProps>) {
  return (
    <ViewInDialog>
      <CreateEndpointFormView
        url="https://example.com/hooks"
        events={["member.invited", "payment.failed"]}
        pending={false}
        invalid={false}
        failed={false}
        onUrlChange={fn()}
        onEventToggle={fn()}
        onSubmit={fn()}
        {...props}
      />
    </ViewInDialog>
  );
}

/**
 * The endpoint is being added: the fields are read-only (not disabled, so that a
 * failure finds the focus where it was), the events are held (a box cannot be
 * read-only), Cancel is held, and Add shows that it works and keeps the focus.
 */
export const Sending: Story = {
  render: () => <FormInDialog pending />,
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Add endpoint");
    const add = within(dialog).getByRole("button", { name: /Add endpoint/ });

    await expect(within(dialog).getByLabelText(/Endpoint URL/)).toHaveAttribute("readonly");
    for (const box of within(dialog).getAllByRole("checkbox")) {
      await expect(box).toBeDisabled();
    }
    await expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await expect(add).toHaveAttribute("aria-disabled", "true");
    await expect(add).not.toBeDisabled();
  },
};

/** The endpoint was not added: what was typed is kept, and the alert is above the button that was just pressed. */
export const Failed: Story = {
  render: () => <FormInDialog failed />,
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Add endpoint");

    await expect(within(dialog).getByRole("alert")).toHaveTextContent("We couldn't add the endpoint. Please try again.");
    await expect(within(dialog).getByLabelText(/Endpoint URL/)).toHaveValue("https://example.com/hooks");
    await expect(within(dialog).getByRole("checkbox", { name: "Member invited" })).toBeChecked();
    await expect(within(dialog).getByRole("button", { name: "Add endpoint" })).toBeEnabled();
  },
};

/** The secret, told once: in mono, with the sentence that says it will not be shown again. */
export const Created: Story = {
  render: () => (
    <ViewInDialog>
      <CreatedEndpointView secret={SECRET} />
    </ViewInDialog>
  ),
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Endpoint added");

    await expect(within(dialog).getByText(SECRET).tagName).toBe("CODE");
    await expect(within(dialog).getByRole("button", { name: "Copy" })).toHaveFocus();
    await expect(within(dialog).getByRole("button", { name: "Done" })).toBeVisible();
  },
};

export const CreatedInFrench: Story = {
  globals: { locale: "fr" },
  render: () => (
    <ViewInDialog>
      <CreatedEndpointView secret={SECRET} />
    </ViewInDialog>
  ),
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Endpoint ajouté");

    await expect(dialog).toHaveAccessibleDescription("Copiez votre secret de signature maintenant. Il ne sera plus affiché ensuite.");
  },
};
