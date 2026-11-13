import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { RoleBadge } from "./role-badge";

// The role of a member, said in words in a quiet badge. The owner and the admin
// are neutral, and a member, who has nothing to add to it, is an outline: no
// tone of the brand or of a status, as a rank is not what a page of people is for.

const meta = {
  title: "Features/RoleBadge",
  component: RoleBadge,
  tags: ["autodocs"],
  args: { role: "member" },
  argTypes: { role: { control: "select", options: ["owner", "admin", "member"] } },
  parameters: { layout: "centered" },
} satisfies Meta<typeof RoleBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Owner: Story = {
  args: { role: "owner" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Owner")).toBeVisible();
  },
};

export const Admin: Story = {
  args: { role: "admin" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Admin")).toBeVisible();
  },
};

/** The quietest of the three: an outline, with no fill. */
export const Member: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Member")).toBeVisible();
  },
};

/** The three side by side, as they read in a list. */
export const Roles: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <RoleBadge role="owner" />
      <RoleBadge role="admin" />
      <RoleBadge role="member" />
    </div>
  ),
};

export const French: Story = {
  args: { role: "admin" },
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Administrateur")).toBeVisible();
  },
};
