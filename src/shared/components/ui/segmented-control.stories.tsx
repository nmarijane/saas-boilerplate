import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { fn } from "storybook/test";

import { SegmentedControl } from "./segmented-control";

type Props = React.ComponentProps<typeof SegmentedControl<string>>;

/** Keeps the value, as the page that uses the control would, and reports each change. */
function Controlled({ value: initial, onValueChange, ...props }: Props) {
  const [value, setValue] = React.useState(initial);

  return (
    <SegmentedControl
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange(next);
      }}
    />
  );
}

const meta = {
  title: "UI/SegmentedControl",
  component: SegmentedControl,
  tags: ["autodocs"],
  argTypes: {
    disabled: {
      control: "boolean",
    },
  },
  args: {
    onValueChange: fn(),
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof SegmentedControl<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The billing switch of a pricing page: arrows, Home and End move the choice. */
export const Default: Story = {
  args: {
    label: "Billing period",
    options: [
      { value: "month", label: "Monthly" },
      { value: "year", label: "Yearly", badge: "2 months free" },
    ],
    value: "month",
  },
};

export const ThreeOptions: Story = {
  args: {
    label: "Range",
    options: [
      { value: "day", label: "Day" },
      { value: "week", label: "Week" },
      { value: "month", label: "Month" },
    ],
    value: "week",
  },
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    value: "year",
    disabled: true,
  },
};

/** French labels run longer: the segments share the width and wrap their text. */
export const LongLabel: Story = {
  args: {
    label: "Période de facturation",
    options: [
      { value: "month", label: "Facturation mensuelle" },
      {
        value: "year",
        label: "Facturation annuelle",
        badge: "2 mois offerts",
      },
    ],
    value: "year",
  },
  decorators: [
    (Story) => (
      <div className="w-72 max-w-full">
        <Story />
      </div>
    ),
  ],
};
