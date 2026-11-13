import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { PasswordResetClient } from "../auth-flows";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { AuthCard } from "./auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

// The form that asks for the link to a new password, in the card the page draws
// around it. As the sign-in form (see its stories), it is given a client that
// answers what it is told to.

const meta = {
  title: "Features/ForgotPasswordForm",
  component: ForgotPasswordForm,
  tags: ["autodocs"],
  decorators: [
    (Story, { globals }) => (
      <div className="mx-auto w-full max-w-md">
        <AuthCard
          title={globals.locale === "fr" ? "Réinitialiser le mot de passe" : "Reset Password"}
          description={
            globals.locale === "fr"
              ? "Nous vous enverrons par email un lien pour choisir un nouveau mot de passe."
              : "We'll email you a link to choose a new password."
          }
        >
          <Story />
        </AuthCard>
      </div>
    ),
  ],
} satisfies Meta<typeof ForgotPasswordForm>;

export default meta;
type Story = StoryObj<typeof meta>;

function fakeClient() {
  return {
    requestPasswordReset: fn<PasswordResetClient["requestPasswordReset"]>(async () => ({ error: null })),
  };
}

type FakeClient = ReturnType<typeof fakeClient>;

/** The client the loader made, as the story holds it. */
function clientOf(loaded: Record<string, unknown>): FakeClient {
  return loaded.client as FakeClient;
}

/** One field and one button. The way back to the sign-in page is the footer of the card the page draws, so the form has no link. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    await expect(canvas.getByRole("button", { name: "Reset Password" })).toBeEnabled();
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

/** An address that is not one is refused under the field, and the server is not asked. */
export const InvalidEmail: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <ForgotPasswordForm client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText("Email"), "nope");
    await userEvent.click(canvas.getByRole("button", { name: "Reset Password" }));
    await expect(await canvas.findByText("Enter a valid email address.")).toBeVisible();
    await expect(canvas.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    await expect(clientOf(loaded).requestPasswordReset).not.toHaveBeenCalled();
  },
};

/**
 * Sending asks for the link, which leads back to the reset page, in the language
 * of this one. A confirmation takes the place of the form, and the focus goes to
 * it. The way back stays where it was: in the footer of the card, which the form
 * does not draw.
 */
export const Sends: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <ForgotPasswordForm client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText("Email"), "camille@example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Reset Password" }));
    await expect(await canvas.findByRole("status")).toHaveTextContent("Email sent! Check your inbox.");
    await expect(client.requestPasswordReset).toHaveBeenCalledOnce();
    await expect(client.requestPasswordReset).toHaveBeenCalledWith({
      email: "camille@example.com",
      redirectTo: "/en/reset-password",
    });
    await expect(canvas.queryByLabelText("Email")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
    await waitFor(() => expect(canvas.getByRole("status").parentElement).toHaveFocus());
  },
};

/** In French the link leads back to the French page. */
export const SendsInFrench: Story = {
  globals: { locale: "fr" },
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <ForgotPasswordForm client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText("Email"), "camille@example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Réinitialiser le mot de passe" }));
    await expect(await canvas.findByRole("status")).toHaveTextContent("Email envoyé ! Vérifiez votre boîte de réception.");
    await expect(client.requestPasswordReset).toHaveBeenCalledWith({
      email: "camille@example.com",
      redirectTo: "/fr/reset-password",
    });
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
  },
};

/** The server refuses with a code the form has no words for: the generic message, never the server's sentence. */
export const Refused: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.requestPasswordReset.mockResolvedValue({ error: { code: "SOMETHING_NEW", message: "Boom: the server's own sentence" } });

      return { client };
    },
  ],
  render: (_args, { loaded }) => <ForgotPasswordForm client={clientOf(loaded)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText("Email"), "camille@example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Reset Password" }));
    const alert = await canvas.findByRole("alert");

    await expect(alert).toHaveTextContent("An error occurred");
    await expect(alert).not.toHaveTextContent("Boom");
    await expect(canvas.getByLabelText("Email")).toHaveValue("camille@example.com");
  },
};

/** A second press while the server has not answered sends nothing more. */
export const OneSendAtATime: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.requestPasswordReset.mockImplementation(() => new Promise(() => {}));

      return { client };
    },
  ],
  render: (_args, { loaded }) => <ForgotPasswordForm client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText("Email"), "camille@example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Reset Password" }));
    const button = await canvas.findByRole("button", { name: /Loading/ });
    // The button that was pressed keeps the focus while it works
    await expect(button).toHaveFocus();
    await userEvent.click(button);

    await expect(client.requestPasswordReset).toHaveBeenCalledOnce();
    await expect(button).toHaveAttribute("aria-disabled", "true");
  },
};
