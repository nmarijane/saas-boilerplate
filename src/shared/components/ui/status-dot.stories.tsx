import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StatusDot } from "./status-dot";

const tones = ["success", "neutral", "warning", "danger", "brand"] as const;

const meta = {
  title: "UI/StatusDot",
  component: StatusDot,
  tags: ["autodocs"],
  argTypes: {
    tone: {
      control: "select",
      options: tones,
    },
    hideLabel: {
      control: "boolean",
    },
  },
  args: { tone: "success", label: "Operational" },
} satisfies Meta<typeof StatusDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Warning: Story = {
  args: { tone: "warning", label: "Degraded" },
};

export const Danger: Story = {
  args: { tone: "danger", label: "Outage" },
};

/** Every tone. The dot echoes the words, it never replaces them. */
export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <StatusDot tone="success" label="Operational" />
      <StatusDot tone="neutral" label="Paused" />
      <StatusDot tone="warning" label="Degraded" />
      <StatusDot tone="danger" label="Outage" />
      <StatusDot tone="brand" label="New" />
    </div>
  ),
};

/** The label takes the text style around it. */
export const InText: Story = {
  render: () => (
    <p className="max-w-prose text-body">
      The API is <StatusDot tone="success" label="operational" /> and the
      dashboard is <StatusDot tone="warning" label="degraded" />: some charts
      load slowly.
    </p>
  ),
};

/** For a place where the words already stand next to it: screen readers still get the label. */
export const HiddenLabel: Story = {
  args: { hideLabel: true },
  render: (args) => (
    <div className="flex items-center gap-3 text-body">
      <span className="font-medium">api.example.com</span>
      <StatusDot {...args} />
      <span className="text-ink-muted">Operational since Monday</span>
    </div>
  ),
};

/** French runs longer: the dot stays round and keeps its place. */
export const LongLabel: Story = {
  args: {
    tone: "danger",
    label: "Incident en cours sur la synchronisation des données",
  },
  decorators: [
    (Story) => (
      <div className="max-w-56">
        <Story />
      </div>
    ),
  ],
};
