import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { PasswordResetClient } from "../auth-flows";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ResetPasswordForm, ResetPasswordFormView } from "./reset-password-form";

// The page the link of the reset email lands on: the form draws its own card, as
// the card says what the form is doing (choosing the password, then done). Most
// of the stories are of the view, as it is told what to draw. The last ones are of
// the form itself, which asks the auth client: the app's has no server here, so
// the form is given a client that answers what it is told to, and the story types
// in it, sends it and says what the form asked.

type ViewProps = React.ComponentProps<typeof ResetPasswordFormView>;

const STRONG = "Secret-123!";

const meta = {
  title: "Features/ResetPasswordForm",
  component: ResetPasswordFormView,
  tags: ["autodocs"],
  args: {
    password: "",
    pending: false,
    failure: null,
    done: false,
    onPasswordChange: fn(),
    onSubmit: fn(),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ResetPasswordFormView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A form that keeps what is typed, as the page does, so that a story can type in it. */
function Typing(props: Partial<ViewProps>) {
  const [password, setPassword] = React.useState("");

  return (
    <ResetPasswordFormView
      password={password}
      pending={false}
      failure={null}
      done={false}
      onPasswordChange={setPassword}
      onSubmit={fn()}
      {...props}
    />
  );
}

/**
 * One field, for a new password, with the autocomplete that tells a password
 * manager what it is, in a card titled Reset Password that has its sentence and a
 * way back to sign in. The button is never off; the strength is told as it is
 * typed, and the rules describe the field.
 */
export const Default: Story = {
  render: () => <Typing />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const send = canvas.getByRole("button", { name: "Reset Password" });
    const field = canvas.getByLabelText("New password");

    await expect(canvas.getByRole("heading", { level: 1, name: "Reset Password" })).toBeVisible();
    await expect(canvas.getByText("Choose a new password for your account.")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Back to sign in" })).toBeVisible();
    await expect(field).toHaveAttribute("autocomplete", "new-password");
    await expect(send).toBeEnabled();
    await expect(canvas.queryByRole("list")).not.toBeInTheDocument();
    await expect(field).not.toHaveAttribute("aria-describedby");

    await userEvent.type(field, "abc");
    await expect(canvas.getAllByRole("listitem")).toHaveLength(5);
    await expect(send).toBeEnabled();
    // The rules describe the field: a screen reader reads them with it
    await expect(field).toHaveAttribute("aria-describedby", canvas.getByRole("list").id);
  },
};

/** The reset is running: the field is read-only, and the button shows that it works and keeps the focus. */
export const Saving: Story = {
  args: { password: STRONG, pending: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const send = canvas.getByRole("button", { name: /Loading/ });

    await expect(canvas.getByLabelText("New password")).toHaveAttribute("readonly");
    await expect(send).toHaveAttribute("aria-disabled", "true");
    await expect(send).not.toBeDisabled();
  },
};

/** The password was sent too weak, and refused: said under its field, in the words of the locale, with the focus sent to the field. What was typed is kept. */
export const TooWeak: Story = {
  args: { password: "abc", failure: "auth.passwordTooWeak" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText("New password");

    await expect(canvas.getByRole("alert")).toHaveTextContent("Password does not meet all requirements");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveValue("abc");
    await waitFor(() => expect(field).toHaveFocus());
    // The field's to say: no alert of the form, and the button is not off
    await expect(canvasElement.querySelector('[data-slot="page-alert"]')).toBeNull();
    await expect(canvas.getByRole("button", { name: "Reset Password" })).toBeEnabled();
  },
};

/** The link expired while the form was open: an alert says so, in the words of the locale, with the way to ask for a new one. What was typed is kept. */
export const Expired: Story = {
  args: { password: STRONG, failure: "auth.errors.invalidToken" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole("alert");

    await expect(alert).toHaveTextContent("This link has expired or was already used.");
    await expect(within(alert).getByRole("link", { name: "Ask for a new link" })).toHaveAttribute("href", expect.stringMatching(/\/forgot-password$/));
    await expect(canvas.getByLabelText("New password")).toHaveValue(STRONG);
    await expect(canvas.getByLabelText("New password")).not.toHaveAttribute("aria-invalid");
  },
};

/** An error the form has no words for gets the generic message of the app, never the sentence of the server. */
export const Failed: Story = {
  args: { password: STRONG, failure: "common.error" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("An error occurred");
  },
};

/**
 * The password has changed: the card is titled Password updated, with no sentence
 * and no footer, and holds the confirmation and a link to sign in. The person is
 * not signed in.
 */
export const Done: Story = {
  args: { done: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 1, name: "Password updated" })).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("Your password has been updated. You can now sign in.");
    await expect(canvas.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", expect.stringMatching(/\/sign-in$/));
    await expect(canvas.queryByLabelText("New password")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Choose a new password for your account.")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("link", { name: "Back to sign in" })).not.toBeInTheDocument();
  },
};

/** The same form in French. */
export const French: Story = {
  globals: { locale: "fr" },
  render: () => <Typing />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 1, name: "Réinitialiser le mot de passe" })).toBeVisible();
    await expect(canvas.getByLabelText("Nouveau mot de passe")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Réinitialiser le mot de passe" })).toBeEnabled();
    await expect(canvas.getByRole("link", { name: "Retour à la connexion" })).toBeVisible();
  },
};

/** The confirmation in French: « Mot de passe mis à jour », and no sentence. */
export const DoneInFrench: Story = {
  globals: { locale: "fr" },
  args: { done: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 1, name: "Mot de passe mis à jour" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Se connecter" })).toBeVisible();
    await expect(canvasElement.querySelector('[data-slot="card-description"]')).toBeNull();
  },
};

// The form itself, with a client that answers what it is told to. The client is
// made before the story renders (a loader), so that the form and the `play`
// function hold the same one, and says what it was asked.

function fakeClient() {
  return {
    resetPassword: fn<PasswordResetClient["resetPassword"]>(async () => ({ error: null })),
  };
}

type FakeClient = ReturnType<typeof fakeClient>;

/** The client the loader made, as the story holds it. */
function clientOf(loaded: Record<string, unknown>): FakeClient {
  return loaded.client as FakeClient;
}

/** Types the new password and presses the button. */
async function send(canvas: ReturnType<typeof within>, password: string) {
  await userEvent.type(canvas.getByLabelText("New password"), password);
  await userEvent.click(canvas.getByRole("button", { name: "Reset Password" }));
}

/**
 * Sending asks for the new password, and nothing
 * else: the person is not signed in. When the server takes it, the card is titled
 * Password updated and holds the confirmation, and the focus goes to it, as the
 * button that had it is gone.
 */
export const Resets: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <ResetPasswordForm client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("Reset Password");
    await send(canvas, STRONG);
    await expect(await canvas.findByRole("status")).toHaveTextContent("Your password has been updated.");
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("Password updated");
    await expect(canvas.queryByText("Choose a new password for your account.")).not.toBeInTheDocument();
    await expect(client.resetPassword).toHaveBeenCalledOnce();
    await expect(client.resetPassword).toHaveBeenCalledWith({ newPassword: STRONG });
    await expect(canvas.queryByLabelText("New password")).not.toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", expect.stringMatching(/\/sign-in$/));
    await waitFor(() => expect(canvas.getByRole("status").parentElement).toHaveFocus());
  },
};

/**
 * A weak password is refused when the form is sent, as sign-up does: the error
 * is the field's, the focus goes to it, the server is asked nothing, and the
 * button was never off. Typing is another try: the error goes.
 */
export const RefusesAWeakPassword: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <ResetPasswordForm client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText("New password");

    await expect(canvas.getByRole("button", { name: "Reset Password" })).toBeEnabled();
    await send(canvas, "abc");
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Password does not meet all requirements");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(field).toHaveFocus());
    await expect(client.resetPassword).not.toHaveBeenCalled();
    await expect(canvas.getByRole("button", { name: "Reset Password" })).toBeEnabled();

    await userEvent.type(field, "D");
    await waitFor(() => expect(canvas.queryByRole("alert")).not.toBeInTheDocument());
  },
};

/** Sent with nothing typed, the button asks the same of the person: a password that meets the rules. Nothing is asked of the server. */
export const RefusesAnEmptyField: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <ResetPasswordForm client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Reset Password" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Password does not meet all requirements");
    await expect(client.resetPassword).not.toHaveBeenCalled();
  },
};

/** The server says the link is dead (it expired while the form was open): an alert in the words of the locale, the way to a new link, and what was typed is kept. */
export const LinkExpired: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.resetPassword.mockResolvedValue({ error: { code: "INVALID_TOKEN", message: "Invalid token" } });

      return { client };
    },
  ],
  render: (_args, { loaded }) => <ResetPasswordForm client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await send(canvas, STRONG);
    const alert = await canvas.findByRole("alert");

    await expect(alert).toHaveTextContent("This link has expired or was already used.");
    await expect(alert).not.toHaveTextContent("Invalid token");
    await expect(within(alert).getByRole("link", { name: "Ask for a new link" })).toBeVisible();
    await expect(client.resetPassword).toHaveBeenCalledOnce();
    await expect(canvas.getByLabelText("New password")).toHaveValue(STRONG);
    await waitFor(() => expect(canvas.getByRole("button", { name: "Reset Password" })).not.toHaveAttribute("aria-disabled", "true"));
  },
};

/** A second press, or a second Enter, while the reset is running sends nothing more. */
export const OneSendAtATime: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.resetPassword.mockImplementation(() => new Promise(() => {}));

      return { client };
    },
  ],
  render: (_args, { loaded }) => <ResetPasswordForm client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await send(canvas, STRONG);
    const button = canvas.getByRole("button", { name: /Loading/ });
    // The button that was pressed keeps the focus while it works
    await expect(button).toHaveFocus();
    await userEvent.click(button);
    await userEvent.type(canvas.getByLabelText("New password"), "{Enter}");

    await expect(client.resetPassword).toHaveBeenCalledOnce();
    await expect(button).toHaveAttribute("aria-disabled", "true");
  },
};

/** Two sends in the same instant, before the page has been drawn again (a double click, two Enters), send once. */
export const OneSendInOneInstant: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.resetPassword.mockImplementation(() => new Promise(() => {}));

      return { client };
    },
  ],
  render: (_args, { loaded }) => <ResetPasswordForm client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);
    const form = canvasElement.querySelector("form");

    await userEvent.type(canvas.getByLabelText("New password"), STRONG);
    form?.requestSubmit();
    form?.requestSubmit();
    await waitFor(() => expect(client.resetPassword).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 150));
    await expect(client.resetPassword).toHaveBeenCalledOnce();
  },
};
