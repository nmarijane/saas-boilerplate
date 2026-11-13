import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ActivityEntry } from "@/shared/shell/contract";
import { expect, within } from "storybook/test";
import { HomeActivity } from "./home-activity";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

// A picture that loads with no network, so that the story shows a photo and not only its fallback.
const PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='gray'/%3E%3Ccircle cx='32' cy='26' r='12' fill='white'/%3E%3Crect x='12' y='42' width='40' height='30' rx='16' fill='white'/%3E%3C/svg%3E";

function entry(id: string, action: string, minutes: number, overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id,
    action,
    actorName: "Léa Martin",
    actorImage: null,
    values: {},
    at: minutesAgo(minutes),
    ...overrides,
  };
}

const ENTRIES: ActivityEntry[] = [
  entry("e1", "project.created", 120, { values: { name: "Atlas" } }),
  entry("e2", "api_key.created", 60 * 5, { actorName: "Camille Laurent", actorImage: PHOTO }),
  entry("e3", "member.invited", 60 * 26, { actorName: "Camille Laurent" }),
  // Nobody did it: it says so, and the person is a neutral figure
  entry("e4", "payment.failed", 60 * 24 * 3, { actorName: null }),
  // An event the sentences do not know
  entry("e5", "custom.thing", 60 * 24 * 9),
];

const meta = {
  title: "Features/HomeActivity",
  component: HomeActivity,
  tags: ["autodocs"],
  args: { entries: ENTRIES },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HomeActivity>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The latest events of the workspace, in a card of rows: the person, what they
 * did and how long ago. A photo, or the initials of the person until it loads;
 * a neutral figure when nobody is named; "did something" for an event the
 * sentences do not know, as a list that skipped it would hide that it happened.
 */
export const Full: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvas.getAllByRole("listitem");

    await expect(canvas.getByRole("heading", { level: 2 })).toHaveTextContent("Activity");
    await expect(rows).toHaveLength(5);
    await expect(within(rows[0] as HTMLElement).getByText("Léa Martin created Atlas")).toBeVisible();
    await expect(within(rows[0] as HTMLElement).getByText("2 hours ago")).toBeVisible();
    await expect(within(rows[1] as HTMLElement).getByText("Camille Laurent created an API key")).toBeVisible();
    await expect(within(rows[2] as HTMLElement).getByText("Camille Laurent invited a new member")).toBeVisible();
    await expect(within(rows[3] as HTMLElement).getByText("A payment failed")).toBeVisible();
    await expect(rows[3]?.querySelector("[data-slot='icon-tile']")).not.toBeNull();
    await expect(rows[3]?.querySelector("[data-slot='initial-tile']")).toBeNull();
    await expect(within(rows[4] as HTMLElement).getByText("Léa Martin did something")).toBeVisible();
    await expect(canvasElement.querySelectorAll("time")).toHaveLength(5);
  },
};

/** Without activity: a compact empty state, in place of the card. */
export const Empty: Story = {
  args: { entries: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 2 })).toHaveTextContent("Activity");
    await expect(canvas.getByRole("heading", { level: 3 })).toHaveTextContent("No activity yet");
    await expect(canvas.queryByRole("list")).toBeNull();
  },
};

/** The name of a project is not ours to choose: a long one breaks inside the card instead of pushing it. */
export const LongName: Story = {
  args: {
    entries: [
      entry("e1", "project.created", 5, {
        values: { name: "Antidisestablishmentarianism_and_other_extraordinarily_long_identifiers_2026" },
      }),
      entry("e2", "project.updated", 50, {
        values: { name: "Relaunch of the customer portal, whose working title is far too long to fit on one line of a row" },
      }),
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector<HTMLElement>("[data-slot='card']");

    await expect(card?.scrollWidth).toBeLessThanOrEqual(card?.clientWidth ?? 0);
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth);
  },
};

/** The same rows in French: the sentences and the times are told in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 2 })).toHaveTextContent("Activité");
    await expect(canvas.getByText("Léa Martin a créé Atlas")).toBeVisible();
    await expect(canvas.getByText("il y a 2 heures")).toBeVisible();
    await expect(canvas.getByText("Un paiement a échoué")).toBeVisible();
  },
};

/** French, with nothing to tell yet. */
export const EmptyFrench: Story = {
  globals: { locale: "fr" },
  args: { entries: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("heading", { level: 3 })).toHaveTextContent("Aucune activité pour l'instant");
  },
};
