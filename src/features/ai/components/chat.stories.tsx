import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { AI_MODELS } from "../config/models";
import { Chat } from "./chat";

// The chat of the assistant, whole: the real hook of the AI SDK and the real
// transport, over a route that each play replaces (the story has no server). A
// play types a message, lets the route refuse, fail or answer, and says what the
// chat tells and what it sent. The route is `fetch` of the page for the length of
// the play, and is put back after it.

const meta = {
  title: "Features/Chat",
  component: Chat,
  tags: ["autodocs"],
  args: {
    conversationId: null,
    orgId: "org_1",
    initialMessages: [],
    availableModels: AI_MODELS.slice(0, 1),
    defaultModel: "gpt-4o-mini",
    // The balance is asked of the server, which a story has not: this is the one that asks nothing
    unlimited: true,
  },
  // The link of an alert keeps the language through the router of next-intl
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: "/ai" } },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto h-[34rem] w-full max-w-3xl overflow-hidden rounded-lg border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Chat>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What the route does with a request: it answers, fails, or waits (and is given the request, to hear when the page gives up). */
type Answer = (init?: RequestInit) => Response | Promise<Response>;

/** The route refuses with this status, and a sentence in English that must never be shown. */
const refuse = (status: number): Answer => () => new Response("Boom: the sentence of the route", { status });

/** The route answers with this text, and names the conversation it started. */
const reply =
  (text: string): Answer =>
  () =>
    new Response(text, { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "X-Conversation-Id": "conv_1" } });

/** The call never reaches the route: the network. */
const offline: Answer = () => {
  throw new TypeError("Failed to fetch");
};

/** The route does not answer until the page gives up on the request (Stop). */
const silent: Answer = (init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("The request was aborted.", "AbortError")));
  });

/**
 * Replaces `fetch` with a route that gives its answers in turn (the last one
 * again, when there are more requests), and records the requests. `restore`
 * puts the page's own back.
 */
function route(first: Answer, ...others: Answer[]) {
  const original = globalThis.fetch;
  const answers = [first, ...others];
  let calls = 0;
  const requests = fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).endsWith("/api/ai/chat")) {
      return original(input, init);
    }
    const answer = answers[Math.min(calls, answers.length - 1)] ?? first;
    calls += 1;

    return answer(init);
  });
  globalThis.fetch = requests as unknown as typeof fetch;

  return { requests, restore: () => (globalThis.fetch = original) };
}

/** The body of the nth request to the route, as the route reads it. */
function bodyOf(requests: ReturnType<typeof route>["requests"], index: number): unknown {
  const init = requests.mock.calls[index]?.[1];

  return JSON.parse(String(init?.body));
}

const fieldOf = (canvas: ReturnType<typeof within>, name = "Message") => canvas.getByRole("textbox", { name });

/** Types a message and sends it with Enter. */
async function say(canvas: ReturnType<typeof within>, text: string, name = "Message") {
  await userEvent.type(fieldOf(canvas, name), `${text}{Enter}`);
}

/** Nothing has gone wrong: the conversation starts empty, and says how to start. */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Start a conversation with any AI model.")).toBeVisible();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await expect(fieldOf(canvas)).toHaveAttribute("placeholder", "Send a message…");
  },
};

/** An admin whose workspace has no credits left: a warning says so, with the way to a bigger plan. The message stays in the conversation. */
export const NoCreditsForAnAdmin: Story = {
  args: { upgradeHref: "/settings/billing" },
  play: async ({ canvasElement }) => {
    const { requests, restore } = route(refuse(402));
    try {
      const canvas = within(canvasElement);

      await say(canvas, "Draft the launch email");
      const alert = await canvas.findByRole("alert");

      await expect(alert).toHaveTextContent("No credits left");
      await expect(alert).toHaveTextContent("Upgrade the plan to keep using the assistant.");
      await expect(alert).not.toHaveTextContent("Boom");
      await expect(within(alert).getByRole("link", { name: "Upgrade" })).toHaveAttribute("href", "/en/settings/billing");
      await expect(canvas.getByText("Draft the launch email")).toBeVisible();
      await expect(requests).toHaveBeenCalledOnce();
      await expect(bodyOf(requests, 0)).toEqual({ messages: [{ role: "user", content: "Draft the launch email" }], model: "gpt-4o-mini" });
    } finally {
      restore();
    }
  },
};

/** A member of that workspace is told to ask an admin: no link, and nothing to press. */
export const NoCreditsForAMember: Story = {
  args: { upgradeHref: null },
  play: async ({ canvasElement }) => {
    const { restore } = route(refuse(402));
    try {
      const canvas = within(canvasElement);

      await say(canvas, "Draft the launch email");
      const alert = await canvas.findByRole("alert");

      await expect(alert).toHaveTextContent("No credits left");
      await expect(alert).toHaveTextContent("Ask an admin to upgrade the plan.");
      await expect(within(alert).queryByRole("link")).not.toBeInTheDocument();
      await expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
    } finally {
      restore();
    }
  },
};

/** The same in French. */
export const NoCreditsInFrench: Story = {
  globals: { locale: "fr" },
  args: { upgradeHref: "/settings/billing" },
  play: async ({ canvasElement }) => {
    const { restore } = route(refuse(402));
    try {
      const canvas = within(canvasElement);

      await say(canvas, "Rédige l'e-mail de lancement", "Message");
      const alert = await canvas.findByRole("alert");

      await expect(alert).toHaveTextContent("Plus de crédits");
      await expect(within(alert).getByRole("link", { name: "Passer au plan supérieur" })).toHaveAttribute("href", "/fr/settings/billing");
      await expect(alert).not.toHaveTextContent("Boom");
    } finally {
      restore();
    }
  },
};

/**
 * A workspace that was deleted, or that the person left (403), a conversation that
 * is not this workspace's (404), a session that ended (401): the chat says the
 * workspace is gone or out of reach, and offers to reload. It offers nothing to
 * retry: sending again would be refused the same.
 */
export const WorkspaceGone: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const status of [403, 404, 401]) {
      const { requests, restore } = route(refuse(status));
      try {
        await say(canvas, `Hello ${status}`);
        await waitFor(() => expect(requests).toHaveBeenCalledOnce());
        const alert = await canvas.findByRole("alert");

        await expect(alert).toHaveTextContent("You can't continue here");
        await expect(alert).toHaveTextContent("Reload the page to continue.");
        await expect(alert).not.toHaveTextContent("Boom");
        await expect(within(alert).getByRole("button", { name: "Reload the page" })).toBeVisible();
        await expect(within(alert).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
      } finally {
        restore();
      }
    }
  },
};

/** A server error, then the person tries again: the same message is sent once more, and the answer comes, with no second copy of the question. */
export const TryAgainAfterAServerError: Story = {
  play: async ({ canvasElement }) => {
    const { requests, restore } = route(refuse(500), reply("Here is a draft."));
    try {
      const canvas = within(canvasElement);

      await say(canvas, "Draft the launch email");
      const alert = await canvas.findByRole("alert");
      await expect(alert).toHaveTextContent("Something went wrong");
      await expect(alert).toHaveTextContent("Your message didn't get an answer. Try again in a moment, or rephrase it.");
      await expect(alert).not.toHaveTextContent("Boom");

      await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));

      await expect(await canvas.findByText("Here is a draft.")).toBeVisible();
      await waitFor(() => expect(canvas.queryByRole("alert")).not.toBeInTheDocument());
      await expect(requests).toHaveBeenCalledTimes(2);
      await expect(bodyOf(requests, 1)).toEqual(bodyOf(requests, 0));
      await expect(canvas.getAllByText("Draft the launch email")).toHaveLength(1);
    } finally {
      restore();
    }
  },
};

/** The network fails: the same account, and trying again goes through. */
export const TryAgainAfterTheNetworkFailed: Story = {
  play: async ({ canvasElement }) => {
    const { requests, restore } = route(offline, reply("Back online."));
    try {
      const canvas = within(canvasElement);

      await say(canvas, "Are you there?");
      const alert = await canvas.findByRole("alert");
      await expect(alert).toHaveTextContent("Your message didn't get an answer.");

      await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));

      await expect(await canvas.findByText("Back online.")).toBeVisible();
      await waitFor(() => expect(canvas.queryByRole("alert")).not.toBeInTheDocument());
      await expect(requests).toHaveBeenCalledTimes(2);
    } finally {
      restore();
    }
  },
};

/**
 * A provider that fails (a key refused, a quota spent) leaves the route with
 * nothing to stream: it answers 200 and an empty body. The chat does not leave
 * the person with an empty message: it says the message got no answer, and offers
 * to try again.
 */
export const AnAnswerThatCameEmpty: Story = {
  play: async ({ canvasElement }) => {
    const { requests, restore } = route(reply(""), reply("A real answer."));
    try {
      const canvas = within(canvasElement);

      await say(canvas, "Hello?");
      const alert = await canvas.findByRole("alert");
      await expect(alert).toHaveTextContent("Your message didn't get an answer.");

      await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));

      await expect(await canvas.findByText("A real answer.")).toBeVisible();
      await waitFor(() => expect(canvas.queryByRole("alert")).not.toBeInTheDocument());
      await expect(requests).toHaveBeenCalledTimes(2);
    } finally {
      restore();
    }
  },
};

/** A reply that came whole says nothing is wrong, and the next message clears an account that is on screen. */
export const AnAnswerAndTheNextMessage: Story = {
  play: async ({ canvasElement }) => {
    const { requests, restore } = route(refuse(500), reply("Fine, now."));
    try {
      const canvas = within(canvasElement);

      await say(canvas, "First");
      await canvas.findByRole("alert");

      await say(canvas, "Second");

      await expect(await canvas.findByText("Fine, now.")).toBeVisible();
      await waitFor(() => expect(canvas.queryByRole("alert")).not.toBeInTheDocument());
      await expect(requests).toHaveBeenCalledTimes(2);
    } finally {
      restore();
    }
  },
};

/** The person stops an answer before its first word: they asked for it, and the chat does not say that the message got no answer. */
export const StoppedBeforeTheFirstWord: Story = {
  play: async ({ canvasElement }) => {
    const { requests, restore } = route(silent);
    try {
      const canvas = within(canvasElement);

      await say(canvas, "Never mind");
      await userEvent.click(await canvas.findByRole("button", { name: "Stop generation" }));

      await waitFor(() => expect(canvas.getByRole("button", { name: "Send message" })).toBeDisabled());
      await new Promise((resolve) => setTimeout(resolve, 300));
      await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
      await expect(requests).toHaveBeenCalledOnce();
    } finally {
      restore();
    }
  },
};

/**
 * A document of 12,000 characters pasted in and sent with Enter: nothing leaves,
 * the text stays whole in the field, and the composer says why. Cut to what the
 * route takes, it is sent as it is.
 */
export const PasteOverTheLimitIsNotSent: Story = {
  play: async ({ canvasElement }) => {
    const { requests, restore } = route(reply("Summarized."));
    try {
      const canvas = within(canvasElement);
      const document = "x".repeat(12_000);

      await userEvent.click(fieldOf(canvas));
      await userEvent.paste(document);
      await userEvent.keyboard("{Enter}");

      await expect(requests).not.toHaveBeenCalled();
      await expect(fieldOf(canvas)).toHaveValue(document);
      await expect(canvas.getByRole("status")).toHaveTextContent("This message is over the limit of 8,000 characters. Shorten it to send it.");
      await expect(canvas.getByRole("button", { name: "Send message" })).toBeDisabled();

      await userEvent.keyboard("{Control>}a{/Control}");
      await userEvent.paste("A short document.");
      await userEvent.keyboard("{Enter}");

      await expect(await canvas.findByText("Summarized.")).toBeVisible();
      await expect(requests).toHaveBeenCalledOnce();
      await expect(bodyOf(requests, 0)).toMatchObject({ messages: [{ role: "user", content: "A short document." }] });
      await expect(fieldOf(canvas)).toHaveValue("");
    } finally {
      restore();
    }
  },
};

/** A message of exactly the limit is sent whole, not a character short. */
export const AMessageOfTheLimitIsSentWhole: Story = {
  play: async ({ canvasElement }) => {
    const { requests, restore } = route(reply("Got it."));
    try {
      const canvas = within(canvasElement);
      const text = "x".repeat(8_000);

      await userEvent.click(fieldOf(canvas));
      await userEvent.paste(text);
      await userEvent.keyboard("{Enter}");

      await expect(await canvas.findByText("Got it.")).toBeVisible();
      const [message] = (bodyOf(requests, 0) as { messages: { content: string }[] }).messages;
      await expect(message?.content).toHaveLength(8_000);
    } finally {
      restore();
    }
  },
};
