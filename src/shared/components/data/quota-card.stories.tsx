import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ShellQuota } from "@/shared/shell/view";
import { FolderIcon, HardDriveIcon, UsersIcon, ZapIcon } from "lucide-react";
import { expect, within } from "storybook/test";
import { QuotaCard } from "./quota-card";

// What the shell hands over: the icon already drawn, the label already translated.
const QUOTA: ShellQuota = {
  id: "projects",
  label: "Projects",
  used: 12,
  limit: 50,
  status: "ok",
  icon: <FolderIcon aria-hidden="true" />,
  tone: 1,
  upgradeHref: "/settings/billing",
};

// A story must not leave the page when the link is followed.
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

// One card in a column, as it sits in a grid of four.
const oneCard: Decorator = (Story) => (
  <div className="max-w-xs">
    <Story />
  </div>
);

const meta = {
  title: "Data/QuotaCard",
  component: QuotaCard,
  tags: ["autodocs"],
  args: { quota: QUOTA },
  decorators: [stayHere],
} satisfies Meta<typeof QuotaCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * How much of a limit of the plan is used: the figure, what it is out of, and a
 * bar. While the quota is fine nothing else is said, and there is nothing to
 * upgrade for.
 */
export const Ok: Story = {
  decorators: [oneCard],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 3 })).toHaveTextContent("Projects");
    await expect(canvas.getByText("12")).toBeVisible();
    await expect(canvas.getByText("of 50")).toBeVisible();
    await expect(canvas.getByRole("progressbar", { name: "Projects" })).toHaveAttribute("aria-valuetext", "12 of 50 used");
    await expect(canvas.queryByText("Running low")).toBeNull();
    await expect(canvas.queryByRole("link")).toBeNull();
  },
};

/** From 80 % the bar turns warning and the state is said in words, with the way up under it. */
export const RunningLow: Story = {
  decorators: [oneCard],
  args: { quota: { ...QUOTA, used: 41, status: "warning" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("41")).toBeVisible();
    await expect(canvas.getByText("Running low")).toBeVisible();
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "41 of 50 used");
    await expect(canvas.getByRole("link", { name: "Upgrade" })).toHaveAttribute("href", expect.stringMatching(/\/settings\/billing$/));
  },
};

/** At the limit the bar is full and red, the state is a danger badge, and the way up stays. */
export const LimitReached: Story = {
  decorators: [oneCard],
  args: { quota: { ...QUOTA, used: 50, status: "limit" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Limit reached")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Upgrade" })).toBeVisible();
  },
};

/** The plan is the highest: nothing above it, so no link to nowhere. */
export const NothingAbove: Story = {
  decorators: [oneCard],
  args: { quota: { ...QUOTA, used: 50, status: "limit", upgradeHref: null } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Limit reached")).toBeVisible();
    await expect(canvas.queryByRole("link")).toBeNull();
  },
};

/** No limit: the figure, and the word. No bar, and never the -1 the shell writes it with. */
export const Unlimited: Story = {
  decorators: [oneCard],
  args: {
    quota: {
      ...QUOTA,
      label: "Members",
      icon: <UsersIcon aria-hidden="true" />,
      tone: 3,
      used: 120,
      limit: -1,
      status: "unlimited",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("120")).toBeVisible();
    await expect(canvas.getByText("Unlimited")).toBeVisible();
    await expect(canvas.queryByRole("progressbar")).toBeNull();
    await expect(canvas.queryByText("-1")).toBeNull();
  },
};

/** A figure carries its unit: a bare 3,200 would not say what it counts. */
export const Storage: Story = {
  decorators: [oneCard],
  args: {
    quota: {
      ...QUOTA,
      label: "Storage",
      icon: <HardDriveIcon aria-hidden="true" />,
      tone: 4,
      used: 3200,
      limit: 10_000,
      unit: "megabyte",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("3,200 MB")).toBeVisible();
    await expect(canvas.getByText("of 10,000 MB")).toBeVisible();
    await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "3,200 MB of 10,000 MB used");
  },
};

/** French runs longer: the label wraps inside the card, which keeps its width. */
export const LongFrenchLabel: Story = {
  globals: { locale: "fr" },
  decorators: [
    (Story) => (
      <div className="max-w-56">
        <Story />
      </div>
    ),
  ],
  args: {
    quota: {
      ...QUOTA,
      label: "Crédits d'IA consommés ce mois-ci par toute votre équipe",
      icon: <ZapIcon aria-hidden="true" />,
      tone: 2,
      used: 4100,
      limit: 5000,
      status: "warning",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvasElement.querySelector<HTMLElement>("[data-slot='card']");

    await expect(canvas.getByText("Bientôt épuisé")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Passer au plan supérieur" })).toBeVisible();
    // The thousands are grouped by a narrow space, which a plain one does not equal
    const valueText = canvas.getByRole("progressbar").getAttribute("aria-valuetext") ?? "";
    await expect(valueText.replaceAll(/\s/g, " ")).toBe("4 100 sur 5 000 utilisés");
    await expect(card?.scrollWidth).toBeLessThanOrEqual(card?.clientWidth ?? 0);
  },
};

/** The row of the home: two across from 640 px and four from 1280 px, the cards telling themselves apart by the tint of their tile. */
export const Row: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-5xl">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <ul role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        QUOTA,
        { ...QUOTA, id: "members", label: "Members", icon: <UsersIcon aria-hidden="true" />, tone: 3 as const, used: 1, limit: 1, status: "limit" as const },
        { ...QUOTA, id: "storage", label: "Storage", icon: <HardDriveIcon aria-hidden="true" />, tone: 4 as const, used: 3200, limit: 10_000, unit: "megabyte" as const },
        { ...QUOTA, id: "credits", label: "AI credits this month", icon: <ZapIcon aria-hidden="true" />, tone: 2 as const, used: 4100, limit: 5000, status: "warning" as const },
      ].map((quota) => (
        <li key={quota.id}>
          <QuotaCard quota={quota} />
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole("listitem")).toHaveLength(4);
    await expect(canvas.getAllByRole("progressbar")).toHaveLength(4);
    await expect(canvas.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Projects",
      "Members",
      "Storage",
      "AI credits this month",
    ]);
  },
};
