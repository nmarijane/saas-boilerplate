import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Label } from "./label";
import { Switch } from "./switch";

const meta = {
  title: "UI/Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: {
    checked: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { id: "digest" },
  render: (args) => (
    <div className="flex items-center gap-3">
      <Switch {...args} />
      <Label htmlFor={args.id} className="font-normal">
        Weekly summary
      </Label>
    </div>
  ),
};

/** Off and on, at rest and disabled. */
export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {[false, true].map((disabled) => (
        <div
          key={String(disabled)}
          className="flex flex-wrap items-center gap-6"
        >
          <Switch aria-label="Off" disabled={disabled} />
          <Switch aria-label="On" defaultChecked disabled={disabled} />
        </div>
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  args: { id: "locked", disabled: true, defaultChecked: true },
  render: (args) => (
    <div className="flex items-center gap-3">
      <Switch {...args} />
      <Label htmlFor={args.id} className="font-normal">
        Managed by your administrator
      </Label>
    </div>
  ),
};

/** A long French label wraps, and the switch stays on its first line. */
export const LongLabel: Story = {
  args: { id: "recap" },
  render: (args) => (
    <div className="flex w-72 max-w-full items-start gap-3">
      <Switch {...args} />
      <Label htmlFor={args.id} className="font-normal leading-6">
        Recevoir un récapitulatif hebdomadaire de l'activité de mon espace de
        travail par e-mail
      </Label>
    </div>
  ),
};
