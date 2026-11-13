import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { SocialSignInClient } from "../auth-flows";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { SocialButtons } from "./social-buttons";

// The other ways in, under the form of the sign-in and sign-up pages: a button
// for each provider the server says is on, and nothing when none is. The buttons
// ask the auth client, which the app has no server for here: the last stories give
// it a client that answers what it is told to (made before the story renders, by a
// loader, so that the buttons and the `play` function hold the same one), press a
// button and say what was asked and what was told.

const meta = {
  title: "Features/SocialButtons",
  component: SocialButtons,
  tags: ["autodocs"],
  args: { providers: ["google", "github"] },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SocialButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

function fakeClient() {
  return {
    signIn: {
      social: fn<SocialSignInClient["signIn"]["social"]>(async () => ({ error: null })),
    },
  };
}

type FakeClient = ReturnType<typeof fakeClient>;

/** The client the loader made, as the story holds it. */
function clientOf(loaded: Record<string, unknown>): FakeClient {
  return loaded.client as FakeClient;
}

/** A client whose server answers with this refusal, and a sentence in English that must never be shown. */
function refusing(code: string) {
  const client = fakeClient();
  client.signIn.social.mockResolvedValue({ error: { code, message: "Boom: the server's own sentence" } });

  return { client };
}

/** A client whose server never answers: a send that is still running. */
function waiting() {
  const client = fakeClient();
  client.signIn.social.mockImplementation(() => new Promise(() => {}));

  return { client };
}

/** One outlined button for each provider that is on, set apart from the form by a separator that says what they are. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Or continue with")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Google" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "GitHub" })).toBeEnabled();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

/** One provider is on: its button alone, on the whole width, and the separator. */
export const OneProvider: Story = {
  args: { providers: ["github"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("button", { name: "GitHub" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Google" })).not.toBeInTheDocument();
    await expect(canvas.getByText("Or continue with")).toBeVisible();
  },
};

/** No provider is on, which is an install that has no OAuth keys: nothing is drawn, not even the separator. */
export const NoProvider: Story = {
  args: { providers: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByText("Or continue with")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

/** The same buttons in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Ou continuer avec")).toBeVisible();
  },
};

/** A press asks for the provider that was pressed, and to be brought back to the dashboard of the language of the page. */
export const AsksForTheProvider: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (args, { loaded }) => <SocialButtons {...args} client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "GitHub" }));
    await waitFor(() => expect(client.signIn.social).toHaveBeenCalledOnce());
    await expect(client.signIn.social).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "/en/dashboard",
      errorCallbackURL: "/en/sign-in",
    });
  },
};

/** In French the person is brought back to the French dashboard. */
export const AsksInFrench: Story = {
  globals: { locale: "fr" },
  loaders: [() => ({ client: fakeClient() })],
  render: (args, { loaded }) => <SocialButtons {...args} client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);

    await userEvent.click(within(canvasElement).getByRole("button", { name: "Google" }));
    await waitFor(() => expect(client.signIn.social).toHaveBeenCalledOnce());
    await expect(client.signIn.social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/fr/dashboard",
      errorCallbackURL: "/fr/sign-in",
    });
  },
};

/**
 * When the server says yes the browser is on its way to the provider: the button
 * that was pressed keeps loading and the other waits, until the page has gone. A
 * second press sends nothing. A `pageshow` that is not from the cache changes
 * nothing, and one that is lets both go: the page is back as it was left.
 */
export const HoldsUntilThePageLeaves: Story = {
  loaders: [() => ({ client: fakeClient() })],
  render: (args, { loaded }) => <SocialButtons {...args} client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "GitHub" }));
    await waitFor(() => expect(client.signIn.social).toHaveBeenCalledOnce());
    // Let go at once, it could be pressed again: it stays busy while the browser goes to the provider
    await new Promise((resolve) => setTimeout(resolve, 150));
    const github = canvas.getByRole("button", { name: /GitHub|Loading/ });
    await expect(github).toHaveAttribute("aria-disabled", "true");
    await expect(canvas.getByRole("button", { name: "Google" })).toBeDisabled();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();

    await userEvent.click(github);
    await expect(client.signIn.social).toHaveBeenCalledOnce();

    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: false }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(github).toHaveAttribute("aria-disabled", "true");

    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "GitHub" })).not.toHaveAttribute("aria-disabled", "true"));
    await expect(canvas.getByRole("button", { name: "Google" })).toBeEnabled();
  },
};

/**
 * The server refuses (a provider that is off is a 404 with its own code): an
 * alert under the separator and above the buttons says so, in the words of the
 * locale and never the server's sentence, and both buttons are let go at once.
 */
export const Refused: Story = {
  loaders: [() => refusing("PROVIDER_NOT_FOUND")],
  render: (args, { loaded }) => <SocialButtons {...args} client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "GitHub" }));
    const alert = await canvas.findByRole("alert");

    await expect(alert).toHaveTextContent("An error occurred");
    await expect(alert).not.toHaveTextContent("Boom");
    await expect(client.signIn.social).toHaveBeenCalledOnce();
    // Under the separator, above the buttons
    await expect(canvas.getByText("Or continue with").compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expect(alert.compareDocumentPosition(canvas.getByRole("button", { name: "GitHub" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => expect(canvas.getByRole("button", { name: "GitHub" })).not.toHaveAttribute("aria-disabled", "true"));
    await expect(canvas.getByRole("button", { name: "Google" })).toBeEnabled();
  },
};

/** A refusal that has a code of its own is told in the words of that code. */
export const RefusedWithItsOwnCode: Story = {
  loaders: [() => refusing("EMAIL_NOT_VERIFIED")],
  render: (args, { loaded }) => <SocialButtons {...args} client={clientOf(loaded)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Google" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Your email isn't verified yet.");
  },
};

/** The same refusal in French. */
export const RefusedInFrench: Story = {
  globals: { locale: "fr" },
  loaders: [() => refusing("PROVIDER_NOT_FOUND")],
  render: (args, { loaded }) => <SocialButtons {...args} client={clientOf(loaded)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "GitHub" }));
    const alert = await canvas.findByRole("alert");

    await expect(alert).toHaveTextContent("Une erreur est survenue");
    await expect(alert).not.toHaveTextContent("Boom");
  },
};

/** A new press starts by forgetting what the last one said: the alert goes while the next send runs. */
export const ANewPressForgetsTheAlert: Story = {
  loaders: [
    () => {
      const client = fakeClient();
      client.signIn.social.mockResolvedValueOnce({ error: { code: "PROVIDER_NOT_FOUND" } });
      client.signIn.social.mockImplementation(() => new Promise(() => {}));

      return { client };
    },
  ],
  render: (args, { loaded }) => <SocialButtons {...args} client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "GitHub" }));
    await canvas.findByRole("alert");
    await waitFor(() => expect(canvas.getByRole("button", { name: "GitHub" })).not.toHaveAttribute("aria-disabled", "true"));

    await userEvent.click(canvas.getByRole("button", { name: "GitHub" }));
    await waitFor(() => expect(client.signIn.social).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(canvas.queryByRole("alert")).not.toBeInTheDocument());
  },
};

/** Two presses in the same instant, before the page has been drawn again, send once. */
export const OneSendAtATime: Story = {
  loaders: [() => waiting()],
  render: (args, { loaded }) => <SocialButtons {...args} client={clientOf(loaded)} />,
  play: async ({ canvasElement, loaded }) => {
    const client = clientOf(loaded);
    const github = within(canvasElement).getByRole("button", { name: "GitHub" });

    github.click();
    github.click();
    await waitFor(() => expect(client.signIn.social).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(client.signIn.social).toHaveBeenCalledOnce();
    await expect(github).toHaveAttribute("aria-disabled", "true");
  },
};
