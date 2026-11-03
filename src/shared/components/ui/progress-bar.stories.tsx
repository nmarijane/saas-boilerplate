import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";

import { Button } from "./button";
import { ProgressBar } from "./progress-bar";

const meta = {
  title: "UI/ProgressBar",
  component: ProgressBar,
  tags: ["autodocs"],
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["quota", "signature"],
    },
  },
  args: { label: "AI credits this month", value: 24, max: 100 },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A quarter used: the bar keeps its usual color. */
export const Quarter: Story = {
  args: { value: 24 },
};

/** From 80 % the bar turns warning. */
export const AlmostOut: Story = {
  args: { value: 82 },
};

/** At the limit, or past it, the bar is full and red. */
export const Limit: Story = {
  args: { value: 100 },
};

/** Past the limit the bar stays full, and says 100 to assistive technology. */
export const OverTheLimit: Story = {
  args: { value: 120 },
};

/** The brand gradient, whatever the value: for progress that is not a quota. */
export const Signature: Story = {
  args: { value: 64, tone: "signature", label: "Setup progress" },
};

/** A negative maximum is unlimited: the bar draws nothing, the text beside it says so. */
export const Unlimited: Story = {
  args: { value: 12, max: -1 },
  render: (args) => (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between text-meta">
        <span className="text-ink-muted">{args.label}</span>
        <span className="font-medium text-ink">Unlimited</span>
      </div>
      <ProgressBar {...args} />
    </div>
  ),
};

function Quota({
  unit,
  value,
  max,
}: {
  unit: string;
  value: number;
  max: number;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between text-meta">
        <span className="text-ink-muted">{unit}</span>
        <span className="font-medium text-ink">
          {max < 0 ? "Unlimited" : `${value} / ${max}`}
        </span>
      </div>
      <ProgressBar label={unit} value={value} max={max} />
    </div>
  );
}

/**
 * How a bar is used: the label names the unit for assistive technology, and
 * the figures beside the bar say it to everyone else.
 */
export const InContext: Story = {
  render: () => (
    <div className="grid gap-5">
      <Quota unit="AI credits this month" value={24} max={100} />
      <Quota unit="Team members" value={8} max={10} />
      <Quota unit="Projects" value={3} max={3} />
      <Quota unit="Storage (MB)" value={48_210} max={-1} />
    </div>
  ),
};

/** French runs longer: the label and the figures share a line, then wrap. */
export const LongLabel: Story = {
  render: () => (
    <div className="max-w-56">
      <Quota
        unit="Crédits IA restants ce mois-ci pour toute l'équipe"
        value={82}
        max={100}
      />
    </div>
  ),
};

function AnimatedDemo() {
  const [value, setValue] = React.useState(24);
  const [run, setRun] = React.useState(0);

  return (
    <div className="grid gap-4">
      {/* A new key mounts the bar again: it arrives, as it does with the page. */}
      <ProgressBar
        key={run}
        label="AI credits this month"
        value={value}
        max={100}
      />
      <div className="flex flex-wrap gap-2">
        {[24, 82, 100].map((next) => (
          <Button
            key={next}
            size="sm"
            variant="outline"
            onClick={() => setValue(next)}
          >
            {next} %
          </Button>
        ))}
        <Button size="sm" variant="secondary" onClick={() => setRun(run + 1)}>
          Arrive again
        </Button>
      </div>
    </div>
  );
}

/**
 * The fill arrives in 320 ms and glides to a new value. Under reduced motion it
 * jumps; browsers without `@starting-style` skip the arrival.
 */
export const Animated: Story = {
  render: () => <AnimatedDemo />,
};
