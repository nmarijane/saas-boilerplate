import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps } from "react";
import {
  ActivityIcon,
  BellIcon,
  CheckIcon,
  CreditCardIcon,
  FolderIcon,
  KeyRoundIcon,
  TriangleAlertIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";

import { IconTile } from "./icon-tile";

type Tone = NonNullable<ComponentProps<typeof IconTile>["tone"]>;

const tones = [
  "brand",
  "neutral",
  "success",
  "warning",
  "danger",
  1,
  2,
  3,
  4,
] as const satisfies readonly Tone[];

const sizes = ["sm", "md", "lg"] as const;

const meta = {
  title: "UI/IconTile",
  component: IconTile,
  tags: ["autodocs"],
  argTypes: {
    icon: { control: false },
    tone: { control: "select", options: tones },
    size: { control: "inline-radio", options: sizes },
  },
  args: { icon: UsersIcon, tone: "brand", size: "md" },
} satisfies Meta<typeof IconTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// An icon of its own per tone, as a page would use them.
const icons = {
  brand: ZapIcon,
  neutral: FolderIcon,
  success: CheckIcon,
  warning: TriangleAlertIcon,
  danger: BellIcon,
  1: UsersIcon,
  2: ActivityIcon,
  3: CreditCardIcon,
  4: KeyRoundIcon,
} as const satisfies Record<Tone, ComponentProps<typeof IconTile>["icon"]>;

/** The five named tones say a state; the four numbered ones only tell things apart. */
export const Tones: Story = {
  render: (args) => (
    <ul className="flex flex-wrap gap-6">
      {tones.map((tone) => (
        <li key={tone} className="flex flex-col items-center gap-2">
          <IconTile {...args} icon={icons[tone]} tone={tone} />
          <span className="text-caption text-ink-muted">{tone}</span>
        </li>
      ))}
    </ul>
  ),
};

/** 32, 40 and 56 px: the corner and the icon grow with the tile. */
export const Sizes: Story = {
  render: (args) => (
    <ul className="flex items-end gap-6">
      {sizes.map((size) => (
        <li key={size} className="flex flex-col items-center gap-2">
          <IconTile {...args} size={size} />
          <span className="text-caption text-ink-muted">{size}</span>
        </li>
      ))}
    </ul>
  ),
};

/** Every tone at every size, to check one against the other in light and in dark. */
export const Matrix: Story = {
  render: (args) => (
    <div className="grid w-fit grid-cols-[auto_repeat(3,auto)] items-center gap-x-8 gap-y-3">
      {tones.map((tone) => (
        <div key={tone} className="contents">
          <span className="text-caption text-ink-muted">{tone}</span>
          {sizes.map((size) => (
            <IconTile
              key={size}
              {...args}
              icon={icons[tone]}
              tone={tone}
              size={size}
            />
          ))}
        </div>
      ))}
    </div>
  ),
};

/** The tile never shrinks: beside a long label, the label wraps. */
export const BesideALabel: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-56">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <div className="flex items-center gap-3">
      <IconTile {...args} />
      <p className="text-body font-medium">
        Membres invités depuis le début du mois
      </p>
    </div>
  ),
};
