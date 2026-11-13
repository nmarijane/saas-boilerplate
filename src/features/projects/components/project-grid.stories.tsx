import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ProjectSummary } from "../queries";
import { expect, within } from "storybook/test";
import { ProjectGrid } from "./project-grid";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

function project(id: string, name: string, overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id,
    name,
    description: null,
    status: "draft",
    createdByName: "Léa Martin",
    createdAt: minutesAgo(60 * 24 * 40),
    updatedAt: minutesAgo(60),
    ...overrides,
  };
}

const PROJECTS = [
  project("p1", "Atlas website", { status: "active", updatedAt: minutesAgo(5) }),
  project("p2", "Borealis mobile app", { updatedAt: minutesAgo(60 * 3) }),
  project("p3", "Customer portal relaunch with a working title that is far too long", { status: "active", updatedAt: minutesAgo(60 * 26) }),
  project("p4", "Drizzle", { updatedAt: minutesAgo(60 * 24 * 4) }),
  project("p5", "Equinox billing", { status: "active", updatedAt: minutesAgo(60 * 24 * 9) }),
  project("p6", "Q3 planning", { updatedAt: minutesAgo(60 * 24 * 21) }),
];

// A story must not leave the page when a card is followed.
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

/** The columns the grid draws at a width: one, two from `sm` (640 px) and three from `lg` (1024 px). */
function columnsAt(width: number) {
  if (width >= 1024) {
    return 3;
  }
  return width >= 640 ? 2 : 1;
}

/** The columns of a grid that follows its container: two from 448 px (`@md`), three from 672 px (`@2xl`). */
function containerColumnsAt(width: number) {
  if (width >= 672) {
    return 3;
  }
  return width >= 448 ? 2 : 1;
}

const meta = {
  title: "Features/ProjectGrid",
  component: ProjectGrid,
  tags: ["autodocs"],
  args: { projects: PROJECTS },
  decorators: [
    stayHere,
    (Story) => (
      <div className="max-w-5xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProjectGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The cards of a list of projects: one column on a phone, two from 640 px and
 * three from 1024 px (the width of the window, as the shell's own breakpoints).
 * Every card of a row is as tall as the tallest, and a long name is cut inside
 * its card.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list");
    const columns = getComputedStyle(list).gridTemplateColumns.split(" ").length;

    await expect(within(list).getAllByRole("listitem")).toHaveLength(6);
    await expect(columns).toBe(columnsAt(window.innerWidth));
    await expect(within(list).getAllByRole("link")).toHaveLength(6);
  },
};

/** One project: the card keeps its width, and the others' places stay empty. */
export const Single: Story = {
  args: { projects: PROJECTS.slice(0, 1) },
};

/**
 * The three latest, as the home shows them: the block they are in is a
 * container, and the columns follow its width: two from 448 px, three from
 * 672 px. Beside the first steps the block is the two thirds of the page, and
 * has the whole width when the steps are gone.
 */
export const Recent: Story = {
  args: { projects: PROJECTS.slice(0, 3), columns: "container" },
  decorators: [
    (Story) => (
      <div className="@container">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list");
    const columns = getComputedStyle(list).gridTemplateColumns.split(" ").length;
    const width = list.getBoundingClientRect().width;

    await expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    await expect(columns).toBe(containerColumnsAt(width));
  },
};

/** The block beside the first steps, in the two thirds of the page: two cards across, and the third under them, rather than three of 140 px. */
export const RecentBesideTheSteps: Story = {
  args: { projects: PROJECTS.slice(0, 3), columns: "container" },
  decorators: [
    (Story) => (
      <div className="max-w-xl @container">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list");

    await expect(getComputedStyle(list).gridTemplateColumns.split(" ")).toHaveLength(2);
    await expect(list.getBoundingClientRect().width).toBeLessThan(672);
  },
};

/** On a phone the block is one column: the cards are stacked, and none is cut. */
export const RecentOnAPhone: Story = {
  args: { projects: PROJECTS.slice(0, 3), columns: "container" },
  decorators: [
    (Story) => (
      <div className="max-w-sm @container">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list");

    await expect(getComputedStyle(list).gridTemplateColumns.split(" ")).toHaveLength(1);
  },
};

export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText("Actif").length).toBeGreaterThan(0);
    await expect(within(canvasElement).getAllByText("Brouillon").length).toBeGreaterThan(0);
  },
};
