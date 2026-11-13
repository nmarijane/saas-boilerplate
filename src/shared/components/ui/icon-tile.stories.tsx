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
import { expect } from "storybook/test";

import { IconTile } from "./icon-tile";

type Tone = NonNullable<ComponentProps<typeof IconTile>["tone"]>;

const tones = [
  "brand",
  "neutral",
  "success",
  "warning",
  "danger",
  "t1",
  "t2",
  "t3",
  "t4",
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
  t1: UsersIcon,
  t2: ActivityIcon,
  t3: CreditCardIcon,
  t4: KeyRoundIcon,
} as const satisfies Record<Tone, ComponentProps<typeof IconTile>["icon"]>;

/** The five named tones say a state; the four numbered ones, `t1` to `t4`, only tell things apart. */
export const Tones: Story = {
  render: ({ size }) => (
    <ul className="flex flex-wrap gap-6">
      {tones.map((tone) => (
        <li key={tone} className="flex flex-col items-center gap-2">
          <IconTile icon={icons[tone]} tone={tone} size={size} />
          <span className="text-caption text-ink-muted">{tone}</span>
        </li>
      ))}
    </ul>
  ),
};

/** 32, 40 and 56 px: the corner and the icon grow with the tile. */
export const Sizes: Story = {
  render: ({ tone }) => (
    <ul className="flex items-end gap-6">
      {sizes.map((size) => (
        <li key={size} className="flex flex-col items-center gap-2">
          <IconTile icon={UsersIcon} tone={tone} size={size} />
          <span className="text-caption text-ink-muted">{size}</span>
        </li>
      ))}
    </ul>
  ),
};

/** Every tone at every size, to check one against the other in light and in dark. */
export const Matrix: Story = {
  render: () => (
    <div className="grid w-fit grid-cols-[auto_repeat(3,auto)] items-center gap-x-8 gap-y-3">
      {tones.map((tone) => (
        <div key={tone} className="contents">
          <span className="text-caption text-ink-muted">{tone}</span>
          {sizes.map((size) => (
            <IconTile
              key={size}
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
  render: ({ tone, size }) => (
    <div className="flex items-center gap-3">
      <IconTile icon={UsersIcon} tone={tone} size={size} />
      <p className="text-body font-medium">
        Membres invités depuis le début du mois
      </p>
    </div>
  ),
};

/**
 * An icon that is already drawn goes in as the children: the shell hands its
 * icons over drawn (a quota's, a first step's), as a component cannot cross
 * from the server to the client. The tile sizes it, as it does its own.
 */
export const Drawn: Story = {
  render: (args) => (
    <ul className="flex items-end gap-6">
      {sizes.map((size) => (
        <li key={size} className="flex flex-col items-center gap-2">
          <IconTile tone={args.tone} size={size}>
            <FolderIcon aria-hidden="true" />
          </IconTile>
          <span className="text-caption text-ink-muted">{size}</span>
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    const icons = [...canvasElement.querySelectorAll<SVGElement>("[data-slot='icon-tile'] > svg")];

    // The icon takes the size the tile gives it: 18, 20 and 26 px
    await expect(icons.map((icon) => Math.round(icon.getBoundingClientRect().width))).toEqual([18, 20, 26]);
  },
};
