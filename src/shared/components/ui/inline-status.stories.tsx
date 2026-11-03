import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import { InlineStatus } from "./inline-status";

const states = ["running", "success", "error"] as const;

const meta = {
  title: "UI/InlineStatus",
  component: InlineStatus,
  tags: ["autodocs"],
  argTypes: {
    state: {
      control: "inline-radio",
      options: states,
    },
  },
  args: { state: "running", children: "Saving…" },
} satisfies Meta<typeof InlineStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A spinner. The status around it speaks, so the spinner stays silent. */
export const Running: Story = {};

export const Success: Story = {
  args: { state: "success", children: "Saved" },
};

export const Failed: Story = {
  args: { state: "error", children: "Could not save" },
};

/** A shape for each state, and the color only echoes it. */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <InlineStatus state="running">Saving…</InlineStatus>
      <InlineStatus state="success">Saved</InlineStatus>
      <InlineStatus state="error">Could not save</InlineStatus>
    </div>
  ),
};

/** Next to what it acts on. A status is announced when its words change. */
export const WithButton: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button>Save changes</Button>
      <InlineStatus state="success">Saved just now</InlineStatus>
    </div>
  ),
};

/** French runs longer: the words wrap beside the icon. */
export const LongLabel: Story = {
  args: {
    state: "error",
    children:
      "Impossible d'enregistrer les modifications du profil pour le moment",
  },
  decorators: [
    (Story) => (
      <div className="max-w-60">
        <Story />
      </div>
    ),
  ],
};
