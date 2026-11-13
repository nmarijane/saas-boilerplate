import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { PasswordClient } from "../account-flows";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ChangePasswordForm, ChangePasswordFormView } from "./change-password-form";

// The form of the password, in the second card of the account page. Most of the
// stories are of the view, as it is told what to draw. The last ones are of the
// form itself, which asks the auth client: the app's has no server here, so the
// form is given a client that answers what it is told to, and the story types in
// it, sends it and says what the form asked.

type ViewProps = React.ComponentProps<typeof ChangePasswordFormView>;

const meta = {
  title: "Features/ChangePasswordForm",
  component: ChangePasswordFormView,
  tags: ["autodocs"],
  args: {
    current: "",
    next: "",
    confirm: "",
    pending: false,
    saved: false,
    failed: false,
    weak: false,
    mismatch: false,
    onCurrentChange: fn(),
    onNextChange: fn(),
    onConfirmChange: fn(),
    onSubmit: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChangePasswordFormView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A form that keeps what is typed, as the page does, so that a story can type in it. */
function Typing(props: Partial<ViewProps>) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  return (
    <ChangePasswordFormView
      current={current}
      next={next}
      confirm={confirm}
      pending={false}
      saved={false}
      failed={false}
      weak={false}
      mismatch={false}
      onCurrentChange={setCurrent}
      onNextChange={setNext}
      onConfirmChange={setConfirm}
      onSubmit={fn()}
      {...props}
    />
  );
}

/**
 * Three passwords, each with the autocomplete that tells a password manager what
 * it is. Change waits for the three; the strength of the new password is told
 * as it is typed.
 */
export const Default: Story = {
  render: () => <Typing />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const change = canvas.getByRole("button", { name: "Change password" });

    await expect(change).toBeDisabled();
    await expect(canvas.queryByRole("list")).not.toBeInTheDocument();

    await userEvent.type(canvas.getByLabelText(/Current password/), "old-Secret-1");
    await userEvent.type(canvas.getByLabelText(/^New password/), "New-Secret-123!");
    await expect(canvas.getByRole("list")).toBeVisible();
    await expect(change).toBeDisabled();
    await userEvent.type(canvas.getByLabelText(/Confirm new password/), "New-Secret-123!");
    await expect(change).toBeEnabled();
  },
};

/** The new password is too weak, and the two differ: each is said under its own field, as an alert. */
export const Refused: Story = {
  render: () => <Typing weak mismatch />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText(/^New password/), "abc");
    await expect(canvas.getAllByRole("alert")).toHaveLength(2);
    await expect(canvas.getByText("Password does not meet all requirements")).toBeVisible();
    await expect(canvas.getByText("Passwords do not match")).toBeVisible();
    await expect(canvas.getByLabelText(/^New password/)).toHaveAttribute("aria-invalid", "true");
  },
};

/** The change is running: the fields are read-only, and the button shows that it works and keeps the focus. */
export const Saving: Story = {
  args: { current: "old-Secret-1", next: "New-Secret-123!", confirm: "New-Secret-123!", pending: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const change = canvas.getByRole("button", { name: /Change password/ });

    await expect(canvas.getByLabelText(/Current password/)).toHaveAttribute("readonly");
    await expect(change).toHaveAttribute("aria-disabled", "true");
    await expect(change).not.toBeDisabled();
  },
};

/** The last change worked: a status next to the button says so. */
export const Changed: Story = {
  args: { saved: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Password changed");
  },
};

/** The server refused (a wrong current password), or did not answer: what was typed is kept, and an alert says so. */
export const Failed: Story = {
  args: { current: "wrong", next: "New-Secret-123!", confirm: "New-Secret-123!", failed: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toHaveTextContent("We couldn't change your password.");
    await expect(canvas.getByLabelText(/Current password/)).toHaveValue("wrong");
  },
};

/** The same form in French. */
export const French: Story = {
  globals: { locale: "fr" },
  render: () => <Typing />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText(/Mot de passe actuel/)).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Changer le mot de passe" })).toBeDisabled();
  },
};

// The form itself, with a client that answers what it is told to. The client is
// made before the story renders (a loader), so that the form and the `play`
// function hold the same one, and says what it was asked.

function fakeClient() {
  return {
    changePassword: fn<PasswordClient["changePassword"]>(async () => ({ error: null })),
  };
}

type FakeClient = ReturnType<typeof fakeClient>;

/** The client the loader made, as the story holds it. */
function clientOf(loaded: Record<string, unknown>): FakeClient {
  return loaded.client as FakeClient;
}

/** Types the three passwords and presses Change. */
async function sendPasswords(canvas: ReturnType<typeof within>, current: string, next: string) {
  await userEvent.type(canvas.getByLabelText(/Current password/), current);
  await userEvent.type(canvas.getByLabelText(/^New password/), next);
  await userEvent.type(canvas.getByLabelText(/Confirm new password/), next);
  await userEvent.click(canvas.getByRole("button", { name: "Change password" }));
}

/**
 * Sending asks for the current password and the new one, and nothing else (the
 * confirmation is the form's, not the server's). When the server takes it the
 * fields are wiped and a status says so.
 */
export const Changes: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <ChangePasswordForm client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await sendPasswords(canvas, "old-Secret-1", "New-Secret-123!");
    await expect(await canvas.findByText("Password changed")).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("Password changed");
    await expect(client.changePassword).toHaveBeenCalledOnce();
    await expect(client.changePassword).toHaveBeenCalledWith({
      currentPassword: "old-Secret-1",
      newPassword: "New-Secret-123!",
      revokeOtherSessions: true,
    });
    await expect(canvas.getByLabelText(/Current password/)).toHaveValue("");
    await expect(canvas.getByLabelText(/^New password/)).toHaveValue("");
    await expect(canvas.getByLabelText(/Confirm new password/)).toHaveValue("");
  },
};

/** The server refuses (a wrong current password): an alert says so, and what was typed is kept, to be fixed and not retyped. */
export const WrongPassword: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.changePassword.mockResolvedValue({ error: { message: "Invalid password", status: 400 } });

      return { client };
    },
  ],
  render: (_args, { loaded }) => <ChangePasswordForm client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await sendPasswords(canvas, "wrong", "New-Secret-123!");
    await expect(await canvas.findByRole("alert")).toHaveTextContent("We couldn't change your password.");
    await expect(client.changePassword).toHaveBeenCalledOnce();
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
    await expect(canvas.getByLabelText(/Current password/)).toHaveValue("wrong");
    await expect(canvas.getByLabelText(/^New password/)).toHaveValue("New-Secret-123!");
    await waitFor(() => expect(canvas.getByRole("button", { name: "Change password" })).not.toHaveAttribute("aria-disabled", "true"));
  },
};
