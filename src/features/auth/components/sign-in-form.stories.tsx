import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { SignInClient } from "../auth-flows";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { AuthCard } from "./auth-card";
import { SignInForm } from "./sign-in-form";

// The form of the sign-in page, in the card the page draws around it. The form
// asks the auth client: the app's has no server here, so each story gives it a
// client that answers what it is told to (made before the story renders, by a
// loader, so that the form and the `play` function hold the same one), types in
// the form, sends it and says what the form asked and what it told.

/** What the server says is on, when a story does not choose: both. */
const BOTH = ["google", "github"] as const;

const meta = {
  title: "Features/SignInForm",
  component: SignInForm,
  tags: ["autodocs"],
  args: { socialProviders: BOTH },
  // The form leaves for the app through the router of next-intl
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: "/sign-in" } },
  },
  decorators: [
    (Story, { globals }) => (
      <div className="mx-auto w-full max-w-md">
        <AuthCard
          title={globals.locale === "fr" ? "Se connecter" : "Sign In"}
          description={
            globals.locale === "fr"
              ? "Content de vous revoir. Connectez-vous pour continuer."
              : "Welcome back. Sign in to continue."
          }
        >
          <Story />
        </AuthCard>
      </div>
    ),
  ],
} satisfies Meta<typeof SignInForm>;

export default meta;
type Story = StoryObj<typeof meta>;

function fakeClient() {
  return {
    signIn: {
      email: fn<SignInClient["signIn"]["email"]>(async () => ({ error: null })),
    },
    sendVerificationEmail: fn<SignInClient["sendVerificationEmail"]>(async () => ({ error: null })),
  };
}

type FakeClient = ReturnType<typeof fakeClient>;

/** The client the loader made, as the story holds it. */
function clientOf(loaded: Record<string, unknown>): FakeClient {
  return loaded.client as FakeClient;
}

/** A client whose server refuses with this code, and a sentence in English that must never be shown. */
function refusing(code: string) {
  const client = fakeClient();
  client.signIn.email.mockResolvedValue({ error: { code, message: "Boom: the server's own sentence" } });

  return { client };
}

/** A client whose limiter refuses: a 429 with a sentence in English that must never be shown, and no code. */
function limited() {
  const client = fakeClient();
  client.signIn.email.mockResolvedValue({ error: { status: 429, message: "Boom: too many requests, in English" } });

  return { client };
}

/** Types an email and a password, and presses Sign In (or the same in French). */
async function signIn(canvas: ReturnType<typeof within>, fr = false) {
  await userEvent.type(canvas.getByLabelText("Email"), "camille@example.com");
  await userEvent.type(canvas.getByLabelText(fr ? "Mot de passe" : "Password"), "Secret-123!");
  await userEvent.click(canvas.getByRole("button", { name: fr ? "Se connecter" : "Sign In" }));
}

/**
 * Two fields with the autocomplete that tells the browser and a password manager
 * what they are, a link to a new password under them, one button, and the other
 * ways in under a separator. The form checks the fields itself, not the browser.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    await expect(canvas.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    await expect(canvas.getByRole("link", { name: "Forgot Password?" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Sign In" })).toBeEnabled();
    await expect(canvas.getByText("Or continue with")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Google" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "GitHub" })).toBeVisible();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

/** Sent empty, each field says what it wants, under itself, and the focus goes to the first one. Nothing is asked of the server. */
export const EmptyFields: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <SignInForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Sign In" }));
    await expect(await canvas.findByText("Enter a valid email address.")).toBeVisible();
    await expect(canvas.getByText("Enter your password.")).toBeVisible();
    await expect(canvas.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(canvas.getByLabelText("Email")).toHaveFocus());
    await expect(clientOf(loaded).signIn.email).not.toHaveBeenCalled();
  },
};

/** Sending asks for the email and the password, and nothing else. Once the server has said yes the button keeps loading until the page has gone. */
export const SignsIn: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <SignInForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await signIn(canvas);
    await waitFor(() => expect(client.signIn.email).toHaveBeenCalledOnce());
    await expect(client.signIn.email).toHaveBeenCalledWith({ email: "camille@example.com", password: "Secret-123!" });
    // Let go at once, it could be pressed again: it stays busy while the browser goes to the app
    await new Promise((resolve) => setTimeout(resolve, 150));
    await expect(canvas.getByRole("button", { name: /Loading/ })).toHaveAttribute("aria-disabled", "true");
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

/** A wrong password: an alert above the button, in the words of the locale and never the server's sentence. What was typed is kept, and the button is let go. */
export const WrongPassword: Story = {
  loaders: [() => refusing("INVALID_EMAIL_OR_PASSWORD")],
  render: (_args, { loaded }) => <SignInForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await signIn(canvas);
    const alert = await canvas.findByRole("alert");

    await expect(alert).toHaveTextContent("Invalid email or password");
    await expect(alert).not.toHaveTextContent("Boom");
    await expect(client.signIn.email).toHaveBeenCalledOnce();
    await expect(canvas.getByLabelText("Email")).toHaveValue("camille@example.com");
    await expect(canvas.getByLabelText("Password")).toHaveValue("Secret-123!");
    await waitFor(() => expect(canvas.getByRole("button", { name: "Sign In" })).not.toHaveAttribute("aria-disabled", "true"));
    // Typing is another try: the alert goes
    await userEvent.type(canvas.getByLabelText("Password"), "x");
    await waitFor(() => expect(canvas.queryByRole("alert")).not.toBeInTheDocument());
  },
};

/** The same refusal in French. */
export const WrongPasswordInFrench: Story = {
  globals: { locale: "fr" },
  loaders: [() => refusing("INVALID_EMAIL_OR_PASSWORD")],
  render: (_args, { loaded }) => <SignInForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await signIn(canvas, true);
    const alert = await canvas.findByRole("alert");

    await expect(alert).toHaveTextContent("Email ou mot de passe invalide");
    await expect(alert).not.toHaveTextContent("Boom");
  },
};

/** The password is right and the address is not verified yet: the form sends the link, to the verify page of the language, and the alert says so. */
export const EmailNotVerified: Story = {
  loaders: [() => refusing("EMAIL_NOT_VERIFIED")],
  render: (_args, { loaded }) => <SignInForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await signIn(canvas);
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Your email isn't verified yet. We've just sent you a new link");
    await expect(client.sendVerificationEmail).toHaveBeenCalledOnce();
    await expect(client.sendVerificationEmail).toHaveBeenCalledWith({
      email: "camille@example.com",
      callbackURL: "/en/verify-email?verified=1",
      fetchOptions: { credentials: "omit" },
    });
  },
};

/** The person came from a page that asked for them to sign in (an invitation): the link carries it, and the way back leads there. */
export const EmailNotVerifiedFromAnInvitation: Story = {
  loaders: [() => refusing("EMAIL_NOT_VERIFIED")],
  render: (_args, { loaded }) => (
    <SignInForm client={clientOf(loaded)} socialProviders={BOTH} callbackUrl="/en/accept-invitation/inv_1" />
  ),
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await signIn(canvas);
    await canvas.findByRole("alert");

    await expect(client.sendVerificationEmail).toHaveBeenCalledOnce();
    await expect(client.sendVerificationEmail).toHaveBeenCalledWith({
      email: "camille@example.com",
      callbackURL: "/en/verify-email?verified=1&callbackUrl=%2Fen%2Faccept-invitation%2Finv_1",
      fetchOptions: { credentials: "omit" },
    });
  },
};

/** The same in French: the link comes back to the verify page of the French site. */
export const EmailNotVerifiedInFrench: Story = {
  globals: { locale: "fr" },
  loaders: [() => refusing("EMAIL_NOT_VERIFIED")],
  render: (_args, { loaded }) => <SignInForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await signIn(canvas, true);
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Votre email n'est pas encore vérifié.");
    await expect(client.sendVerificationEmail).toHaveBeenCalledOnce();
    await expect(client.sendVerificationEmail).toHaveBeenCalledWith({
      email: "camille@example.com",
      callbackURL: "/fr/verify-email?verified=1",
      fetchOptions: { credentials: "omit" },
    });
  },
};

/** The link could not be sent: the alert does not say that it is on its way. */
export const VerificationLinkNotSent: Story = {
  loaders: [
    () => {
      const { client } = refusing("EMAIL_NOT_VERIFIED");
      client.sendVerificationEmail.mockResolvedValue({ error: { code: "VERIFICATION_EMAIL_NOT_ENABLED", message: "Boom: the server's own sentence" } });

      return { client };
    },
  ],
  render: (_args, { loaded }) => <SignInForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await signIn(canvas);
    const alert = await canvas.findByRole("alert");

    await expect(alert).toHaveTextContent("An error occurred");
    await expect(alert).not.toHaveTextContent("new link");
    await expect(alert).not.toHaveTextContent("Boom");
  },
};

/** The limiter refused (a 429): the alert says to wait a moment, not that the app failed, and never the server's sentence. */
export const TooManyAttempts: Story = {
  loaders: [() => limited()],
  render: (_args, { loaded }) => <SignInForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await signIn(canvas);
    const alert = await canvas.findByRole("alert");

    await expect(alert).toHaveTextContent("Too many attempts. Wait a moment, then try again.");
    await expect(alert).not.toHaveTextContent("An error occurred");
    await expect(alert).not.toHaveTextContent("Boom");
    await expect(client.sendVerificationEmail).not.toHaveBeenCalled();
    // What was typed is kept, and the button is let go: the person tries again in a moment
    await expect(canvas.getByLabelText("Password")).toHaveValue("Secret-123!");
    await waitFor(() => expect(canvas.getByRole("button", { name: "Sign In" })).not.toHaveAttribute("aria-disabled", "true"));
  },
};

/** The same refusal in French. */
export const TooManyAttemptsInFrench: Story = {
  globals: { locale: "fr" },
  loaders: [() => limited()],
  render: (_args, { loaded }) => <SignInForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await signIn(canvas, true);
    const alert = await canvas.findByRole("alert");

    await expect(alert).toHaveTextContent("Trop de tentatives. Patientez un instant, puis réessayez.");
    await expect(alert).not.toHaveTextContent("Boom");
  },
};

/** A provider that was cancelled brings the person back to this page with the code in the address: the alert says so, from the first draw. */
export const ProviderCancelled: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => (
    <SignInForm client={clientOf(loaded)} socialProviders={BOTH} initialFailure="auth.errors.accessDenied" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByRole("alert")).toHaveTextContent("Sign-in was cancelled. You can try again.");
    // Typing is another try: the alert goes
    await userEvent.type(canvas.getByLabelText("Email"), "c");
    await waitFor(() => expect(canvas.queryByRole("alert")).not.toBeInTheDocument());
  },
};

/** A code the form has no words for gets the generic message of the app. */
export const UnknownRefusal: Story = {
  loaders: [() => refusing("SOMETHING_NEW")],
  render: (_args, { loaded }) => <SignInForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await signIn(canvas);
    const alert = await canvas.findByRole("alert");

    await expect(alert).toHaveTextContent("An error occurred");
    await expect(alert).not.toHaveTextContent("Boom");
  },
};

/** A second press, or a second Enter, while the server has not answered sends nothing more; the fields wait, read-only, and the button keeps the focus. */
export const OneSendAtATime: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.signIn.email.mockImplementation(() => new Promise(() => {}));

      return { client };
    },
  ],
  render: (_args, { loaded }) => <SignInForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await signIn(canvas);
    const button = await canvas.findByRole("button", { name: /Loading/ });
    // The button that was pressed keeps the focus while it works
    await expect(button).toHaveFocus();
    await userEvent.click(button);
    await userEvent.type(canvas.getByLabelText("Password"), "{Enter}");

    await expect(client.signIn.email).toHaveBeenCalledOnce();
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(canvas.getByLabelText("Email")).toHaveAttribute("readonly");
    await expect(canvas.getByLabelText("Password")).toHaveAttribute("readonly");
  },
};

/** Two sends in the same instant, before the page has been drawn again (a double click, two Enters), send once. */
export const OneSendInOneInstant: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.signIn.email.mockImplementation(() => new Promise(() => {}));

      return { client };
    },
  ],
  render: (_args, { loaded }) => <SignInForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);
    const form = canvasElement.querySelector("form");

    await userEvent.type(canvas.getByLabelText("Email"), "camille@example.com");
    await userEvent.type(canvas.getByLabelText("Password"), "Secret-123!");
    form?.requestSubmit();
    form?.requestSubmit();
    await waitFor(() => expect(client.signIn.email).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 150));
    await expect(client.signIn.email).toHaveBeenCalledOnce();
  },
};

/** A new send starts by forgetting what the last one said: the alert goes while the next send runs. */
export const ANewSendForgetsTheAlert: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.signIn.email.mockResolvedValueOnce({ error: { code: "INVALID_EMAIL_OR_PASSWORD" } });
      client.signIn.email.mockImplementation(() => new Promise(() => {}));

      return { client };
    },
  ],
  render: (_args, { loaded }) => <SignInForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await signIn(canvas);
    await canvas.findByRole("alert");
    await waitFor(() => expect(canvas.getByRole("button", { name: "Sign In" })).not.toHaveAttribute("aria-disabled", "true"));

    await userEvent.click(canvas.getByRole("button", { name: "Sign In" }));
    await waitFor(() => expect(client.signIn.email).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(canvas.queryByRole("alert")).not.toBeInTheDocument());
  },
};

/** One provider is on: its button alone under the form. */
export const OneProvider: Story = {
  args: { socialProviders: ["github"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("button", { name: "GitHub" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Google" })).not.toBeInTheDocument();
    await expect(canvas.getByText("Or continue with")).toBeVisible();
  },
};

/** No provider is on, which is an install that has no OAuth keys: no separator and no button, and the form is whole. */
export const NoProvider: Story = {
  args: { socialProviders: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByText("Or continue with")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Google" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "GitHub" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Sign In" })).toBeVisible();
    await expect(canvas.getByLabelText("Email")).toBeVisible();
  },
};

/** The same form in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("Email")).toBeVisible();
    await expect(canvas.getByLabelText("Mot de passe")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Mot de passe oublié ?" })).toBeVisible();
    await expect(canvas.getByText("Ou continuer avec")).toBeVisible();
  },
};
