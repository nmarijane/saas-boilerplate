import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Checkbox } from "./checkbox";
import { Label } from "./label";

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  argTypes: {
    checked: {
      control: "inline-radio",
      options: [true, false, "indeterminate"],
    },
    disabled: {
      control: "boolean",
    },
    "aria-invalid": {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { id: "digest" },
  render: (args) => (
    <div className="flex items-start gap-3">
      <Checkbox {...args} />
      <Label htmlFor={args.id} className="font-normal leading-5">
        Send me a weekly summary
      </Label>
    </div>
  ),
};

/** Unchecked, checked and mixed, at rest and disabled. */
export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {[false, true].map((disabled) => (
        <div
          key={String(disabled)}
          className="flex flex-wrap items-center gap-6"
        >
          <Checkbox aria-label="Unchecked" disabled={disabled} />
          <Checkbox aria-label="Checked" defaultChecked disabled={disabled} />
          <Checkbox
            aria-label="Mixed"
            checked="indeterminate"
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  ),
};

/** `aria-invalid` gives a danger border, and a danger focus ring. The message goes next to it. */
export const Invalid: Story = {
  render: () => (
    <div className="grid gap-1.5">
      <div className="flex items-start gap-3">
        <Checkbox id="accept" aria-invalid aria-describedby="accept-error" />
        <Label htmlFor="accept" className="font-normal leading-5">
          I accept the terms of service
        </Label>
      </div>
      <p id="accept-error" role="alert" className="text-meta text-danger-text">
        You need to accept the terms to continue.
      </p>
    </div>
  ),
};

/** Unchecked, checked and mixed, all invalid: the danger border stays on a checked or mixed box (the fill stays primary). */
export const InvalidStates: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Checkbox aria-label="Unchecked" aria-invalid />
      <Checkbox aria-label="Checked" aria-invalid defaultChecked />
      <Checkbox aria-label="Mixed" aria-invalid checked="indeterminate" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { id: "locked", disabled: true, defaultChecked: true },
  render: (args) => (
    <div className="flex items-start gap-3">
      <Checkbox {...args} />
      <Label htmlFor={args.id} className="font-normal leading-5">
        Managed by your administrator
      </Label>
    </div>
  ),
};

/** A long French label wraps, and the box stays on its first line. */
export const LongLabel: Story = {
  args: { id: "cgu" },
  render: (args) => (
    <div className="flex w-72 max-w-full items-start gap-3">
      <Checkbox {...args} />
      <Label htmlFor={args.id} className="font-normal leading-5">
        J'accepte les conditions d'utilisation et la politique de
        confidentialité de la plateforme
      </Label>
    </div>
  ),
};
