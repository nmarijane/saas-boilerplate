import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ChatError } from "./chat-error";

// What the chat tells when its route refuses or fails, one story for each state:
// no credits left (an admin is offered the way to a bigger plan, a member is told
// to ask an admin), a workspace that is gone or out of reach, and a message that
// got no answer. The plays press the buttons and say what was asked.

const meta = {
  title: "Features/ChatError",
  component: ChatError,
  tags: ["autodocs"],
  args: {
    failure: "failed",
    upgradeHref: null,
    onReload: fn(),
    onRetry: fn(),
  },
  // The link of the alert keeps the language through the router of next-intl
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: "/ai" } },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatError>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No credits left, for an admin: a warning, with the way to a bigger plan. */
export const NoCreditsForAnAdmin: Story = {
  args: { failure: "credits", upgradeHref: "/settings/billing" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toHaveTextContent("No credits left");
    await expect(canvas.getByRole("alert")).toHaveTextContent("Upgrade the plan to keep using the assistant.");
    await expect(canvas.getByRole("link", { name: "Upgrade" })).toHaveAttribute("href", "/en/settings/billing");
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

/** No credits left, for a member: told to ask an admin, with nothing to press that they could not use. */
export const NoCreditsForAMember: Story = {
  args: { failure: "credits", upgradeHref: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toHaveTextContent("No credits left");
    await expect(canvas.getByRole("alert")).toHaveTextContent("Ask an admin to upgrade the plan.");
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

/** A workspace that is gone or out of reach (403, 404, a session that ended): it says so, and offers to reload. */
export const WorkspaceGone: Story = {
  args: { failure: "gone" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toHaveTextContent("You can't continue here");
    await expect(canvas.getByRole("alert")).toHaveTextContent("Reload the page to continue.");
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Reload the page" }));
    await expect(args.onReload).toHaveBeenCalledOnce();
    await expect(args.onRetry).not.toHaveBeenCalled();
  },
};

/** A message that got no answer (the network, a server that failed, a provider that gave nothing): it offers to try again. */
export const TryAgain: Story = {
  args: { failure: "failed" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toHaveTextContent("Something went wrong");
    await expect(canvas.getByRole("alert")).toHaveTextContent("Your message didn't get an answer. Try again in a moment, or rephrase it.");
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
    await expect(args.onReload).not.toHaveBeenCalled();
  },
};

/** The three states in French, for an admin. */
export const InFrench: Story = {
  globals: { locale: "fr" },
  args: { failure: "credits", upgradeHref: "/settings/billing" },
  render: (args) => (
    <div className="grid gap-3">
      <ChatError {...args} failure="credits" />
      <ChatError {...args} failure="gone" />
      <ChatError {...args} failure="failed" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Plus de crédits")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Passer au plan supérieur" })).toHaveAttribute("href", "/fr/settings/billing");
    await expect(canvas.getByText("Vous ne pouvez pas continuer ici")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Recharger la page" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Réessayer" })).toBeVisible();
  },
};

/** A member in French: told to ask an administrator. */
export const NoCreditsForAMemberInFrench: Story = {
  globals: { locale: "fr" },
  args: { failure: "credits", upgradeHref: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("Demandez à un administrateur de passer à un plan supérieur.");
  },
};
