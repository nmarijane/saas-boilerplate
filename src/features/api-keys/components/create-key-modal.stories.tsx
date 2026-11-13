import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, fireEvent, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent } from "@/shared/components/ui/dialog";
import { CreatedKeyView, CreateKeyFormView, CreateKeyModal } from "./create-key-modal";

// The dialog that creates an API key. The server action it calls is replaced by
// `create`, which answers by itself: a story has no server, and Storybook's stub
// of a server action answers with no data, which is not a key. What a refusal and
// a wait look like is shown here too, by a `create` that fails and by one that
// waits.

const KEY = "sk_live_Zk3V-EXAMPLE-0000-0000-0000";

/** What the server answers: the key, or why it was not made. */
type Answer = { id: string; key: string; prefix: string } | { error: string };

const DAY = 24 * 60 * 60 * 1000;

/** A day as a date field holds it: `2026-11-05`. The stories ask for days by the clock of the day they run, so that none goes out of date. */
function dayFrom(offset: number): string {
  return new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
}

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

/**
 * A clock that a story sets and moves, in place of the page's: the dialog reads `new Date()` when it
 * opens, and again when the key is sent. `restore` gives the page its own back.
 */
function installClock(start: string) {
  const RealDate = Date;
  let offset = new RealDate(start).getTime() - RealDate.now();

  class StoryDate extends RealDate {
    constructor(...args: unknown[]) {
      super(...((args.length === 0 ? [RealDate.now() + offset] : args) as [number]));
    }

    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = StoryDate as DateConstructor;

  return {
    advance: (milliseconds: number) => {
      offset += milliseconds;
    },
    restore: () => {
      globalThis.Date = RealDate;
    },
  };
}

/** A dialog that is open when the story loads; its trigger opens it again once closed. */
function Example({
  open: initialOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof CreateKeyModal>) {
  const [open, setOpen] = React.useState(initialOpen);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open the dialog
      </Button>
      <CreateKeyModal
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

/** The body of the page of the story, where Radix draws the dialog. */
function bodyOf(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

/**
 * The overlay is what a click beside the dialog lands on, and Radix turns the
 * pointer events of the page itself off while a dialog is open.
 */
function overlayOf(canvasElement: HTMLElement): HTMLElement {
  return canvasElement.ownerDocument.querySelector('[data-slot="dialog-overlay"]') as HTMLElement;
}

const meta = {
  title: "Features/CreateKeyModal",
  component: CreateKeyModal,
  args: {
    orgId: "org_1",
    open: true,
    onOpenChange: () => {},
    create: fn(async (): Promise<Answer> => ({ id: "k1", key: KEY, prefix: "sk_live_Zk3V" })),
  },
  argTypes: { onOpenChange: { action: "onOpenChange" } },
  parameters: {
    layout: "centered",
    // The dialog reads the page again through the router of the app, once the
    // key exists: Storybook has none, and mounts a stand-in for the stories that
    // say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/settings/developers" } },
    // While a dialog is open, Radix hides the page (the trigger included) from
    // assistive technology and traps the focus in the dialog: the trigger
    // cannot be reached, which axe cannot tell.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<typeof CreateKeyModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A name and a scope are all it needs: the name has the focus, and "Create key"
 * waits for it (it is disabled while the field is empty, or holds only spaces). A
 * key starts with every scope, as it always did; the end is for those who want one.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Create API key");
    const name = within(dialog).getByLabelText(/Name/);
    const create = within(dialog).getByRole("button", { name: "Create key" });

    await expect(name).toHaveFocus();
    await expect(create).toBeDisabled();
    await expect(within(dialog).getByRole("group", { name: "Scopes" })).toBeVisible();
    await expect(within(dialog).getAllByRole("checkbox").map((box) => box.getAttribute("aria-checked"))).toEqual(["false", "false", "false", "true"]);
    await expect(within(dialog).getByLabelText("Expiration")).toHaveValue("");
    // The field offers no end before tomorrow: a key that ends today is over before it is used
    await expect(within(dialog).getByLabelText("Expiration")).toHaveAttribute("min", dayFrom(1));

    await userEvent.type(name, "   ");
    await expect(create).toBeDisabled();

    await userEvent.type(name, "Production server");
    await expect(create).toBeEnabled();
    await expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  },
};

/** A key must be allowed something: with no scope ticked, Create waits. */
export const NeedsAScope: Story = {
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Create API key");
    const create = within(dialog).getByRole("button", { name: "Create key" });

    await userEvent.type(within(dialog).getByLabelText(/Name/), "Production server");
    await expect(create).toBeEnabled();

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "All (wildcard)" }));
    await expect(create).toBeDisabled();

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Read" }));
    await expect(create).toBeEnabled();
  },
};

/** The name stops at what the server takes: 100 characters. */
export const NameLimit: Story = {
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Create API key");
    const name = within(dialog).getByLabelText(/Name/);

    await userEvent.type(name, "a".repeat(120));

    await expect(name).toHaveValue("a".repeat(100));
  },
};

/**
 * The key is made with what was typed, and then the dialog tells it, once: the
 * key in mono, the sentence that says it will not be shown again, the button that
 * copies it (it has the focus) and Done. Done closes the dialog, and the key is
 * gone for good: the dialog that opens again is empty, with no key.
 */
export const CreatesAKey: Story = {
  play: async ({ args, canvasElement }) => {
    const { page, dialog } = await findDialog(canvasElement, "Create API key");

    await userEvent.type(within(dialog).getByLabelText(/Name/), "  Production server ");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "All (wildcard)" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Read" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Write" }));
    // A date is set whole: typed key by key, a date field is given "2", "20"... which are no date
    fireEvent.change(within(dialog).getByLabelText("Expiration"), { target: { value: dayFrom(366) } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Create key" }));

    const created = await page.findByRole("dialog", { name: "API key created" });
    await expect(args.create).toHaveBeenCalledOnce();
    await expect(args.create).toHaveBeenCalledWith("org_1", {
      name: "Production server",
      scopes: ["read", "write"],
      expiresAt: new Date(`${dayFrom(366)}T00:00:00.000Z`),
    });
    await waitFor(() => expect(within(created).getByText(KEY)).toBeVisible());
    await expect(created).toHaveAccessibleDescription("Copy your key now. You won't be able to see it again.");
    await expect(within(created).getByRole("button", { name: "Copy" })).toHaveFocus();
    // What was typed is gone from the dialog: it holds the key, and nothing of the form
    await expect(within(created).queryByRole("textbox")).not.toBeInTheDocument();

    await userEvent.click(within(created).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open the dialog" }));
    const again = await page.findByRole("dialog", { name: "Create API key" });
    await expect(within(again).getByLabelText(/Name/)).toHaveValue("");
    await expect(within(again).getByLabelText("Expiration")).toHaveValue("");
    await expect(within(again).getByRole("checkbox", { name: "All (wildcard)" })).toBeChecked();
    await expect(page.queryByText(KEY)).not.toBeInTheDocument();
  },
};

/**
 * A key that ends today is over before it is used, and would be counted nowhere:
 * the field offers no end before tomorrow, and an end that is typed all the same is
 * refused under the field, as an alert tied to it, which names the first day that
 * is taken. Nothing is sent. Choosing another day is another try: the message goes,
 * and tomorrow is a good day.
 */
export const RefusesAnEndThatIsPast: Story = {
  play: async ({ args, canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Create API key");
    const end = within(dialog).getByLabelText("Expiration");

    await userEvent.type(within(dialog).getByLabelText(/Name/), "Production server");
    fireEvent.change(end, { target: { value: dayFrom(0) } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Create key" }));

    // It names the first day that is taken, written as the page writes a date
    const earliest = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${dayFrom(1)}T00:00:00Z`));
    await expect(within(dialog).getByRole("alert")).toHaveTextContent(`Choose ${earliest} or later.`);
    await expect(end).toHaveAttribute("aria-invalid", "true");
    await expect(end).toHaveValue(dayFrom(0));
    await expect(args.create).not.toHaveBeenCalled();

    fireEvent.change(end, { target: { value: dayFrom(1) } });
    await expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Create key" }));

    const shown = await bodyOf(canvasElement).findByRole("dialog", { name: "API key created" });
    await waitFor(() => expect(shown).toBeVisible());
    await expect(args.create).toHaveBeenCalledOnce();
  },
};

let clock: ReturnType<typeof installClock> | undefined;

/**
 * A dialog that stays open for a few minutes can be open across midnight (UTC): the first day it offered
 * when it opened is today when the key is sent. The end that it refuses is checked against the day of that
 * moment, and the message names that day and the field offers it: it never says "choose November 5 or later"
 * under a field that holds November 5 and offers it.
 */
export const StaysOpenAcrossMidnight: Story = {
  beforeEach: () => {
    clock = installClock("2026-11-04T23:58:00.000Z");

    return () => clock?.restore();
  },
  play: async ({ args, canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Create API key");
    const end = within(dialog).getByLabelText("Expiration");

    // It opened at 23:58 UTC: the first day it offers is the next one
    await expect(end).toHaveAttribute("min", "2026-11-05");
    await userEvent.type(within(dialog).getByLabelText(/Name/), "Production server");
    fireEvent.change(end, { target: { value: "2026-11-05" } });

    // The key is sent at 00:01 UTC: that day is today now
    clock?.advance(3 * 60 * 1000);
    await userEvent.click(within(dialog).getByRole("button", { name: "Create key" }));

    await expect(await within(dialog).findByRole("alert")).toHaveTextContent("Choose November 6, 2026 or later.");
    await expect(end).toHaveAttribute("min", "2026-11-06");
    await expect(end).toHaveValue("2026-11-05");
    await expect(args.create).not.toHaveBeenCalled();
  },
};

/**
 * The clock of a page is not always the server's: a few minutes before midnight
 * (UTC) an end that the field offers is already today for the server. The server
 * answers with its reason, which names the day it takes, and the dialog shows it
 * under the end, as an alert tied to the field, as it does for an end that is
 * past: what was typed is kept, the error reporter is not told (nothing failed),
 * and another day is another try.
 */
export const RefusedByTheServer: Story = {
  args: {
    create: fn(async (): Promise<Answer> => ({ error: "Choose November 6, 2026 or later." })),
  },
  beforeEach: catchReports,
  play: async ({ args, canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Create API key");
    const end = within(dialog).getByLabelText("Expiration");

    await userEvent.type(within(dialog).getByLabelText(/Name/), "Production server");
    fireEvent.change(end, { target: { value: dayFrom(1) } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Create key" }));

    await expect(await within(dialog).findByRole("alert")).toHaveTextContent("Choose November 6, 2026 or later.");
    await expect(args.create).toHaveBeenCalledOnce();
    await expect(end).toHaveAttribute("aria-invalid", "true");
    await expect(end).toHaveValue(dayFrom(1));
    await expect(within(dialog).getByLabelText(/Name/)).toHaveValue("Production server");
    await expect(reported).not.toHaveBeenCalled();
    await expect(within(dialog).queryByText("We couldn't create the key. Please try again.")).not.toBeInTheDocument();
    await expect(within(dialog).getByRole("button", { name: "Create key" })).toBeEnabled();

    // Another day is another try: the reason goes
    fireEvent.change(end, { target: { value: dayFrom(2) } });
    await expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  },
};

/**
 * While the key is on screen a click beside the dialog does nothing: it would
 * discard a key that cannot be shown again, with no warning. The dialog is not
 * even asked to close. Escape closes it, as it is meant to: that is a choice.
 */
export const OutsideClickKeepsTheKey: Story = {
  args: { onOpenChange: fn() },
  play: async ({ args, canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Create API key");

    await userEvent.type(within(dialog).getByLabelText(/Name/), "Production server");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create key" }));
    const created = await bodyOf(canvasElement).findByRole("dialog", { name: "API key created" });
    await waitFor(() => expect(within(created).getByText(KEY)).toBeVisible());

    await userEvent.click(overlayOf(canvasElement));

    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(bodyOf(canvasElement).getByRole("dialog", { name: "API key created" })).toBeVisible();
    await expect(bodyOf(canvasElement).getByText(KEY)).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(bodyOf(canvasElement).queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

/** Done closes it too, as it is the choice made on purpose. */
export const DoneClosesTheKey: Story = {
  args: { onOpenChange: fn() },
  play: async ({ args, canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Create API key");

    await userEvent.type(within(dialog).getByLabelText(/Name/), "Production server");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create key" }));
    const created = await bodyOf(canvasElement).findByRole("dialog", { name: "API key created" });

    await userEvent.click(within(created).getByRole("button", { name: "Done" }));

    await waitFor(() => expect(bodyOf(canvasElement).queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

/** The form is not the key: a click beside it closes it, as it always did. Only the screen that tells the key is guarded. */
export const OutsideClickClosesTheForm: Story = {
  args: { onOpenChange: fn() },
  play: async ({ args, canvasElement }) => {
    await findDialog(canvasElement, "Create API key");

    await userEvent.click(overlayOf(canvasElement));

    await waitFor(() => expect(bodyOf(canvasElement).queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

/**
 * Closing the dialog some other way than Done leaves no key behind either:
 * Escape on the screen that tells it, and the dialog is empty when it opens again.
 */
export const KeyIsNotKept: Story = {
  play: async ({ canvasElement }) => {
    const { page, dialog } = await findDialog(canvasElement, "Create API key");

    await userEvent.type(within(dialog).getByLabelText(/Name/), "Production server");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create key" }));
    await waitFor(async () => expect(await page.findByText(KEY)).toBeVisible());

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open the dialog" }));
    const again = await page.findByRole("dialog", { name: "Create API key" });
    await expect(within(again).getByLabelText(/Name/)).toHaveValue("");
    await expect(page.queryByText(KEY)).not.toBeInTheDocument();
  },
};

// A creation that does not come back until the story says so.
const gate = { release: (_answer: { id: string; key: string; prefix: string }) => {} };

/**
 * While the key is being made the dialog waits: Create shows that it works and
 * keeps the focus, a second press does nothing (the server is asked once), the
 * fields and the buttons are held, and neither Escape nor a click outside closes
 * the dialog: a key made while it is gone would be one nobody has seen.
 */
export const WaitsForTheServer: Story = {
  args: {
    // A spy of its own, to say that the dialog was never asked to close
    onOpenChange: fn(),
    create: fn(
      () =>
        new Promise<{ id: string; key: string; prefix: string }>((resolve) => {
          gate.release = resolve;
        }),
    ),
  },
  play: async ({ args, canvasElement }) => {
    const { page, dialog } = await findDialog(canvasElement, "Create API key");
    const name = within(dialog).getByLabelText(/Name/);

    await userEvent.type(name, "Production server");
    const create = within(dialog).getByRole("button", { name: "Create key" });
    await userEvent.dblClick(create);

    await waitFor(() => expect(create).toHaveAttribute("aria-disabled", "true"));
    await expect(create).not.toBeDisabled();
    await expect(args.create).toHaveBeenCalledOnce();
    await expect(name).toHaveAttribute("readonly");
    await expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();

    await userEvent.keyboard("{Escape}");
    // A click outside is a click on the overlay: Radix turns the pointer events of the page itself off
    await userEvent.click(canvasElement.ownerDocument.querySelector('[data-slot="dialog-overlay"]') as HTMLElement);
    // The dialog is asked to close by neither, and is still there: it fades out when it does close, so that it would
    // be on the page a moment after being asked
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(page.getByRole("dialog", { name: "Create API key" })).toBeVisible();

    gate.release({ id: "k1", key: KEY, prefix: "sk_live_Zk3V" });
    await expect(await page.findByRole("dialog", { name: "API key created" })).toBeVisible();
    await expect(args.create).toHaveBeenCalledOnce();
  },
};

/**
 * The server refuses, or does not answer: what was typed is kept, the dialog says
 * so with an alert, and Create can be pressed again. Typing is another try: the
 * alert goes. The error is still told to the reporter of the app.
 */
export const Fails: Story = {
  args: {
    create: fn(async () => {
      throw new Error("offline");
    }),
  },
  beforeEach: catchReports,
  play: async ({ args, canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Create API key");
    const name = within(dialog).getByLabelText(/Name/);

    await userEvent.type(name, "Production server");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create key" }));

    await expect(await within(dialog).findByRole("alert")).toHaveTextContent("We couldn't create the key. Please try again.");
    await expect(args.create).toHaveBeenCalledOnce();
    await expect(reported).toHaveBeenCalledOnce();
    await expect(name).toHaveValue("Production server");
    await expect(within(dialog).getByRole("button", { name: "Create key" })).toBeEnabled();

    await userEvent.type(name, "!");
    await expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  },
};

/** Cancel closes the dialog, and an empty dialog is what opens again. */
export const Cancels: Story = {
  play: async ({ args, canvasElement }) => {
    const { page, dialog } = await findDialog(canvasElement, "Create API key");

    await userEvent.type(within(dialog).getByLabelText(/Name/), "Production server");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.create).not.toHaveBeenCalled();

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open the dialog" }));
    const again = await page.findByRole("dialog", { name: "Create API key" });
    await expect(within(again).getByLabelText(/Name/)).toHaveValue("");
  },
};

/** The same dialog in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Créer une clé d'API");

    await expect(within(dialog).getByLabelText(/Nom/)).toHaveFocus();
    await expect(within(dialog).getByRole("group", { name: "Permissions" })).toBeVisible();
    await expect(within(dialog).getByRole("checkbox", { name: "Toutes (joker)" })).toBeChecked();
    await expect(within(dialog).getByRole("button", { name: "Créer la clé" })).toBeDisabled();
  },
};

// The views of the dialog, in the dialog they live in, for what `create` cannot show as it stands.
type FormProps = React.ComponentProps<typeof CreateKeyFormView>;

function ViewInDialog({ children }: { children: React.ReactNode }) {
  return (
    <Dialog open>
      <DialogContent size="sm">{children}</DialogContent>
    </Dialog>
  );
}

function FormInDialog(props: Partial<FormProps>) {
  return (
    <ViewInDialog>
      <CreateKeyFormView
        name="Production server"
        scopes={["read", "write"]}
        expires="2026-12-31"
        earliestEnd="2026-11-05"
        pending={false}
        endPast={false}
        failed={false}
        onNameChange={fn()}
        onScopeToggle={fn()}
        onExpiresChange={fn()}
        onSubmit={fn()}
        {...props}
      />
    </ViewInDialog>
  );
}

/**
 * The key is being made: the fields are read-only (not disabled, so that a
 * failure finds the focus where it was), the scopes are held (a box cannot be
 * read-only), Cancel is held, and Create shows that it works and keeps the focus.
 */
export const Sending: Story = {
  render: () => <FormInDialog pending />,
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Create API key");
    const create = within(dialog).getByRole("button", { name: /Create key/ });

    await expect(within(dialog).getByLabelText(/Name/)).toHaveAttribute("readonly");
    await expect(within(dialog).getByLabelText("Expiration")).toHaveAttribute("readonly");
    for (const box of within(dialog).getAllByRole("checkbox")) {
      await expect(box).toBeDisabled();
    }
    await expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await expect(create).toHaveAttribute("aria-disabled", "true");
    await expect(create).not.toBeDisabled();
  },
};

/** The key was not made: what was typed is kept, and the alert is above the button that was just pressed. */
export const Failed: Story = {
  render: () => <FormInDialog failed />,
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Create API key");

    await expect(within(dialog).getByRole("alert")).toHaveTextContent("We couldn't create the key. Please try again.");
    await expect(within(dialog).getByLabelText(/Name/)).toHaveValue("Production server");
    await expect(within(dialog).getByRole("button", { name: "Create key" })).toBeEnabled();
  },
};

/** The key, told once: in mono, whole even when it is long, with the sentence that says it will not be shown again. */
export const Created: Story = {
  render: () => (
    <ViewInDialog>
      <CreatedKeyView secret={KEY} />
    </ViewInDialog>
  ),
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "API key created");
    const key = within(dialog).getByText(KEY);

    await expect(key.tagName).toBe("CODE");
    await expect(key.scrollWidth).toBeLessThanOrEqual(key.clientWidth);
    await expect(within(dialog).getByRole("button", { name: "Copy" })).toHaveFocus();
    await expect(within(dialog).getByRole("button", { name: "Done" })).toBeVisible();
  },
};

export const CreatedInFrench: Story = {
  globals: { locale: "fr" },
  render: () => (
    <ViewInDialog>
      <CreatedKeyView secret={KEY} />
    </ViewInDialog>
  ),
  play: async ({ canvasElement }) => {
    const { dialog } = await findDialog(canvasElement, "Clé d'API créée");

    await expect(dialog).toHaveAccessibleDescription("Copiez votre clé maintenant. Elle ne sera plus affichée ensuite.");
    await expect(within(dialog).getByRole("button", { name: "Terminé" })).toBeVisible();
  },
};
