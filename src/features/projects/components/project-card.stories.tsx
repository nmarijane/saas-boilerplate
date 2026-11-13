import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ProjectSummary } from "../queries";
import { expect, within } from "storybook/test";
import { ProjectCard } from "./project-card";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const PROJECT: ProjectSummary = {
  id: "project_atlas",
  name: "Atlas website",
  description: "Rebuild the marketing site on the new design system.",
  status: "active",
  createdByName: "Léa Martin",
  createdAt: minutesAgo(60 * 24 * 30),
  updatedAt: minutesAgo(120),
};

// A story must not leave the page when the card is followed.
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

const meta = {
  title: "Features/ProjectCard",
  component: ProjectCard,
  tags: ["autodocs"],
  args: { project: PROJECT },
  decorators: [
    stayHere,
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProjectCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A project in a list: its tile, tinted from its id, its name, its status in
 * words, and when it changed. The whole card is the one link to the project.
 */
export const Active: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const links = canvas.getAllByRole("link");

    await expect(links).toHaveLength(1);
    await expect(links[0]).toHaveAccessibleName(/Atlas website/);
    await expect(links[0]).toHaveAttribute("href", expect.stringMatching(/\/projects\/project_atlas$/));
    await expect(canvas.getByText("Active")).toBeVisible();
    await expect(canvas.getByText("2 hours ago")).toBeVisible();
  },
};

/** A draft has a neutral dot and says so: the color is never alone. */
export const Draft: Story = {
  args: { project: { ...PROJECT, status: "draft", updatedAt: minutesAgo(3) } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Draft")).toBeVisible();
    await expect(within(canvasElement).getByText("3 minutes ago")).toBeVisible();
  },
};

/** The name stops at two lines and the card keeps its width, even for a word that does not break. */
export const LongName: Story = {
  args: {
    project: {
      ...PROJECT,
      name: "Relaunch of the customer portal, with a working title that is far too long to fit on two lines of a card",
    },
  },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link");
    const name = within(link).getByText(/Relaunch of the customer portal/);

    await expect(getComputedStyle(name).webkitLineClamp).toBe("2");
    await expect(link.scrollWidth).toBeLessThanOrEqual(link.clientWidth);
  },
};

export const UnbrokenWord: Story = {
  args: {
    project: { ...PROJECT, name: "Antidisestablishmentarianism_and_other_extraordinarily_long_identifiers_2026" },
  },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link");

    await expect(link.scrollWidth).toBeLessThanOrEqual(link.clientWidth);
    await expect(link.getBoundingClientRect().width).toBeLessThanOrEqual(canvasElement.getBoundingClientRect().width);
  },
};

/** A short name: the initials are the first letter of each of its first two words. */
export const ShortName: Story = {
  args: { project: { ...PROJECT, name: "Q3", updatedAt: minutesAgo(60 * 24 * 3) } },
};

/** The same card in French: the sentence and the time are told in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Actif")).toBeVisible();
    await expect(canvas.getByText("il y a 2 heures")).toBeVisible();
  },
};
