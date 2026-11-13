import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { SignUpClient } from "../auth-flows";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { AuthCard } from "./auth-card";
import { SignUpForm } from "./sign-up-form";

// The form of the sign-up page, in the card the page draws around it. As the
// sign-in form (see its stories), it is given a client that answers what it is
// told to.

const STRONG = "Secret-123!";

/** What the server says is on, when a story does not choose: both. */
const BOTH = ["google", "github"] as const;

const meta = {
  title: "Features/SignUpForm",
  component: SignUpForm,
  tags: ["autodocs"],
  args: { socialProviders: BOTH },
  decorators: [
    (Story, { globals }) => (
      <div className="mx-auto w-full max-w-md">
        <AuthCard
          title={globals.locale === "fr" ? "S'inscrire" : "Sign Up"}
          description={
            globals.locale === "fr"
              ? "Créez votre compte pour commencer."
              : "Create your account to get started."
          }
        >
          <Story />
        </AuthCard>
      </div>
    ),
  ],
} satisfies Meta<typeof SignUpForm>;

export default meta;
type Story = StoryObj<typeof meta>;

function fakeClient() {
  return {
    signUp: {
      email: fn<SignUpClient["signUp"]["email"]>(async () => ({ error: null })),
    },
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
  client.signUp.email.mockResolvedValue({ error: { code, message: "Boom: the server's own sentence" } });

  return { client };
}

/** Types the four fields (the last two are the same password unless told otherwise) and presses Sign Up. */
async function signUp(canvas: ReturnType<typeof within>, password = STRONG, confirm = password) {
  await userEvent.type(canvas.getByLabelText("Name"), "Camille Laurent");
  await userEvent.type(canvas.getByLabelText("Email"), "camille@example.com");
  await userEvent.type(canvas.getByLabelText("Password"), password);
  await userEvent.type(canvas.getByLabelText("Confirm Password"), confirm);
  await userEvent.click(canvas.getByRole("button", { name: "Sign Up" }));
}

/** Four fields with the autocomplete that tells a password manager what they are, one button, and the other ways in under it. The meter shows once there is a password. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("Name")).toHaveAttribute("autocomplete", "name");
    await expect(canvas.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
    await expect(canvas.getByLabelText("Confirm Password")).toHaveAttribute("autocomplete", "new-password");
    await expect(canvas.queryByRole("list")).not.toBeInTheDocument();
    await expect(canvas.getByText("Or continue with")).toBeVisible();
  },
};

/** The strength of the password is told as it is typed, rule by rule, by icon and by words. */
export const Strength: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const said = () => canvas.getAllByRole("listitem").map((item) => item.querySelector(".sr-only")?.textContent);

    await expect(canvas.getByLabelText("Password")).not.toHaveAttribute("aria-describedby");
    await userEvent.type(canvas.getByLabelText("Password"), "abc");
    await expect(said()).toEqual(["not met", "not met", "met", "not met", "not met"]);
    // The rules describe the field: a screen reader reads them with it
    await expect(canvas.getByLabelText("Password")).toHaveAttribute("aria-describedby", canvas.getByRole("list").id);
    await userEvent.type(canvas.getByLabelText("Password"), "DEFG12!");
    await expect(said()).toEqual(["met", "met", "met", "met", "met"]);
  },
};

/** Sent empty, each field says what it wants. Nothing is asked of the server. */
export const EmptyFields: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <SignUpForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Sign Up" }));
    await expect(await canvas.findByText("Enter your name.")).toBeVisible();
    await expect(canvas.getByText("Enter a valid email address.")).toBeVisible();
    await expect(canvas.getByText("Password does not meet all requirements")).toBeVisible();
    await waitFor(() => expect(canvas.getByLabelText("Name")).toHaveFocus());
    await expect(clientOf(loaded).signUp.email).not.toHaveBeenCalled();
  },
};

/** A password that fails a rule is refused when the form is sent, under its field, and the server is not asked. */
export const WeakPassword: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <SignUpForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);

    await signUp(canvas, "abcdefgh");
    await expect(await canvas.findByText("Password does not meet all requirements")).toBeVisible();
    await expect(canvas.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    await expect(clientOf(loaded).signUp.email).not.toHaveBeenCalled();
  },
};

/** Two passwords that differ: said under the second one. */
export const Mismatch: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <SignUpForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);

    await signUp(canvas, STRONG, "Another-123!");
    await expect(await canvas.findByText("Passwords do not match")).toBeVisible();
    await expect(clientOf(loaded).signUp.email).not.toHaveBeenCalled();
  },
};

/** Sending asks for the name, the email and the password, and nothing else. When the account exists a confirmation takes the place of the form, and the focus goes to it. */
export const Creates: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (_args, { loaded }) => <SignUpForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await signUp(canvas);
    await expect(await canvas.findByRole("status")).toHaveTextContent("Email sent! Check your inbox.");
    await expect(client.signUp.email).toHaveBeenCalledOnce();
    await expect(client.signUp.email).toHaveBeenCalledWith({
      name: "Camille Laurent",
      email: "camille@example.com",
      password: STRONG,
      callbackURL: "/en/verify-email?verified=1",
    });
    await expect(canvas.queryByLabelText("Name")).not.toBeInTheDocument();
    await waitFor(() => expect(canvas.getByRole("status").parentElement).toHaveFocus());
  },
};

/** The address has an account already: an alert in the words of the locale, and what was typed is kept. */
export const AlreadyExists: Story = {
  loaders: [() => refusing("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")],
  render: (_args, { loaded }) => <SignUpForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await signUp(canvas);
    const alert = await canvas.findByRole("alert");

    await expect(alert).toHaveTextContent("An account with this email already exists.");
    await expect(alert).not.toHaveTextContent("Boom");
    await expect(canvas.getByLabelText("Email")).toHaveValue("camille@example.com");
    await waitFor(() => expect(canvas.getByRole("button", { name: "Sign Up" })).not.toHaveAttribute("aria-disabled", "true"));
  },
};

/** A second press while the server has not answered sends nothing more. */
export const OneSendAtATime: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.signUp.email.mockImplementation(() => new Promise(() => {}));

      return { client };
    },
  ],
  render: (_args, { loaded }) => <SignUpForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await signUp(canvas);
    const button = await canvas.findByRole("button", { name: /Loading/ });
    // The button that was pressed keeps the focus while it works
    await expect(button).toHaveFocus();
    await userEvent.click(button);

    await expect(client.signUp.email).toHaveBeenCalledOnce();
    await expect(button).toHaveAttribute("aria-disabled", "true");
  },
};

/** Two sends in the same instant, before the page has been drawn again (a double click, two Enters), send once. */
export const OneSendInOneInstant: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.signUp.email.mockImplementation(() => new Promise(() => {}));

      return { client };
    },
  ],
  render: (_args, { loaded }) => <SignUpForm client={clientOf(loaded)} socialProviders={BOTH} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);
    const form = canvasElement.querySelector("form");

    await userEvent.type(canvas.getByLabelText("Name"), "Camille Laurent");
    await userEvent.type(canvas.getByLabelText("Email"), "camille@example.com");
    await userEvent.type(canvas.getByLabelText("Password"), STRONG);
    await userEvent.type(canvas.getByLabelText("Confirm Password"), STRONG);
    form?.requestSubmit();
    form?.requestSubmit();
    await waitFor(() => expect(client.signUp.email).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 150));
    await expect(client.signUp.email).toHaveBeenCalledOnce();
  },
};

/** One provider is on: its button alone under the form. */
export const OneProvider: Story = {
  args: { socialProviders: ["google"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("button", { name: "Google" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "GitHub" })).not.toBeInTheDocument();
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
    await expect(canvas.getByRole("button", { name: "Sign Up" })).toBeVisible();
  },
};

/** The same form in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("Nom")).toBeVisible();
    await expect(canvas.getByLabelText("Confirmer le mot de passe")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "S'inscrire" })).toBeVisible();
  },
};
