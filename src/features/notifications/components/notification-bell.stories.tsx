import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { NotificationBell } from "./notification-bell";

// The bell on the background it is drawn on in the shell (the sidebar and the
// header are both `--side-bg`), so that the ring of its dot reads as it does
// there. The bell alone: what opens from it is the notification center's.

const meta = {
  title: "Features/NotificationBell",
  component: NotificationBell,
  args: { count: 0 },
  argTypes: { count: { control: { type: "number", min: 0 } } },
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="bg-sidebar p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NotificationBell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing to read: the bell alone, named "Notifications". */
export const NothingUnread: Story = {
  play: async ({ canvasElement }) => {
    const bell = within(canvasElement).getByRole("button", { name: "Notifications" });

    await expect(bell).toBeVisible();
    await expect(canvasElement.querySelector('[data-slot="bell-dot"]')).not.toBeInTheDocument();
  },
};

/**
 * Something to read: a dot of 8 px in the brand color, and the count in the
 * name of the button. No number is drawn, and the dot is hidden from assistive
 * technology, which has the name.
 */
export const Unread: Story = {
  args: { count: 3 },
  play: async ({ canvasElement }) => {
    const bell = within(canvasElement).getByRole("button", { name: "Notifications: 3 unread" });
    const dot = canvasElement.querySelector('[data-slot="bell-dot"]');

    await expect(bell).toBeVisible();
    await expect(dot).toBeInTheDocument();
    await expect(dot).toHaveAttribute("aria-hidden", "true");
    await expect(bell.textContent).toBe("");
  },
};

/** A lot to read is still a dot: the figure is for the name of the button. */
export const ManyUnread: Story = {
  args: { count: 128 },
  play: async ({ canvasElement }) => {
    const bell = within(canvasElement).getByRole("button", { name: "Notifications: 128 unread" });

    await expect(bell.textContent).toBe("");
  },
};

/** One unread notification reads in the singular. */
export const OneUnread: Story = {
  args: { count: 1 },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Notifications: 1 unread" }),
    ).toBeVisible();
  },
};

/** The name of the button, and the plural, in French. */
export const French: Story = {
  args: { count: 2 },
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Notifications : 2 non lues" }),
    ).toBeVisible();
  },
};
