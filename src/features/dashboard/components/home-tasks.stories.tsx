import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import type { HomeTask } from "@/shared/shell/view";
import { FolderPlusIcon, KeyRoundIcon, UserPlusIcon } from "lucide-react";
import { expect, within } from "storybook/test";
import { HomeTasks } from "./home-tasks";

// What the shell hands over: the icon already drawn, the words already translated.
const PROJECT: HomeTask = {
  id: "first-project",
  label: "Create your first project",
  icon: <FolderPlusIcon aria-hidden="true" />,
  tone: 1,
  done: true,
  action: { href: "/projects", label: "Create a project" },
};
const TEAM: HomeTask = {
  id: "invite-team",
  label: "Invite your first teammate",
  icon: <UserPlusIcon aria-hidden="true" />,
  tone: 3,
  done: true,
  action: { href: "/settings/team", label: "Invite a teammate" },
};
const KEY: HomeTask = {
  id: "api-key",
  label: "Create your first API key",
  icon: <KeyRoundIcon aria-hidden="true" />,
  tone: 2,
  done: false,
  action: { href: "/settings/developers", label: "Create an API key" },
};

// A story must not leave the page when a button is followed.
const stayHere: Decorator = (Story) => (
  <div
    onClickCapture={(event) => {
      if ((event.target as HTMLElement).closest("a")) {
        event.preventDefault();
      }
    }}
  >
    <Story />
  </div>
);

// The column of the home that holds the steps: a third of the page, from lg.
const inTheColumn: Decorator = (Story) => (
  <div className="max-w-xs">
    <Story />
  </div>
);

const meta = {
  title: "Features/HomeTasks",
  component: HomeTasks,
  tags: ["autodocs"],
  args: { tasks: [PROJECT, TEAM, KEY], done: 2 },
  decorators: [stayHere],
} satisfies Meta<typeof HomeTasks>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The first steps, in their order: how many are done, a check on a success tile
 * for those that are (with no button, there is nothing left to do), and for the
 * one that is not its own tile, and a secondary button to where it is done.
 */
export const Default: Story = {
  decorators: [inTheColumn],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvas.getAllByRole("listitem");

    await expect(canvas.getByRole("heading", { level: 2 })).toHaveTextContent("First steps");
    await expect(canvas.getByText("2 of 3")).toBeVisible();
    await expect(rows).toHaveLength(3);
    // The steps that are done have no button; the other has one
    await expect(within(rows[0] as HTMLElement).queryByRole("link")).toBeNull();
    await expect(within(rows[1] as HTMLElement).queryByRole("link")).toBeNull();
    await expect(within(rows[2] as HTMLElement).getByRole("link", { name: "Create an API key" })).toHaveAttribute(
      "href",
      expect.stringMatching(/\/settings\/developers$/),
    );
    // The word that says it is done is read, and not seen
    await expect(within(rows[0] as HTMLElement).getByText("Done:")).toBeInTheDocument();
  },
};

/** Nothing done yet: every step has its tile and its button. */
export const NothingDone: Story = {
  decorators: [inTheColumn],
  args: { tasks: [{ ...PROJECT, done: false }, { ...TEAM, done: false }, KEY], done: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("0 of 3")).toBeVisible();
    await expect(canvas.getAllByRole("link")).toHaveLength(3);
    await expect(canvas.queryByText("Done:")).toBeNull();
  },
};

/** Every step done: the home takes the block away, and this is what it would have shown. */
export const AllDone: Story = {
  decorators: [inTheColumn],
  args: { tasks: [PROJECT, TEAM, { ...KEY, done: true }], done: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("3 of 3")).toBeVisible();
    await expect(canvas.queryByRole("link")).toBeNull();
  },
};

/** French runs longer: the label wraps in the narrow column, and the button stays under it whole. */
export const French: Story = {
  globals: { locale: "fr" },
  decorators: [inTheColumn],
  args: {
    tasks: [
      { ...PROJECT, label: "Créez votre premier projet" },
      { ...TEAM, label: "Invitez votre premier membre", done: false, action: { href: "/settings/team", label: "Inviter un membre" } },
      { ...KEY, label: "Créez votre première clé d'API", action: { href: "/settings/developers", label: "Créer une clé d'API" } },
    ],
    done: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvasElement.querySelector<HTMLElement>("[data-slot='card']");

    await expect(canvas.getByRole("heading", { level: 2 })).toHaveTextContent("Premiers pas");
    await expect(canvas.getByText("1 sur 3")).toBeVisible();
    await expect(canvas.getByText("Fait :")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Inviter un membre" })).toBeVisible();
    await expect(card?.scrollWidth).toBeLessThanOrEqual(card?.clientWidth ?? 0);
  },
};

/** The same steps with a full row to themselves, as on a phone: the label has the width, and the button is still under it. */
export const FullWidth: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
};
