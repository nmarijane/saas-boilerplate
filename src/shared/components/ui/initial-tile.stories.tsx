import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { InitialTile, toneOf } from "./initial-tile";

const sizes = ["sm", "md", "lg"] as const;

// One name for each of the four tones, as the hash of the tile hands them out.
const names = ["Studio Nord", "Atelier Sud", "Ada Lovelace", "Acme"] as const;

const meta = {
  title: "UI/InitialTile",
  component: InitialTile,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "inline-radio", options: sizes },
  },
  args: { name: "Studio Nord", size: "md" },
} satisfies Meta<typeof InitialTile>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two initials on a tint, for an entity that has no picture: a workspace, a project, a person. */
export const Default: Story = {};

/** 32, 40 and 56 px: the corner and the letters grow with the tile. */
export const Sizes: Story = {
  render: (args) => (
    <ul className="flex items-end gap-6">
      {sizes.map((size) => (
        <li key={size} className="flex flex-col items-center gap-2">
          <InitialTile {...args} size={size} />
          <span className="text-caption text-ink-muted">{size}</span>
        </li>
      ))}
    </ul>
  ),
};

/** The four tints of the theme. A name always gets the same one, so the tiles of a list tell their entities apart with no legend. */
export const Tones: Story = {
  render: (args) => (
    <ul className="flex flex-wrap gap-6">
      {names.map((name) => (
        <li key={name} className="flex flex-col items-center gap-2">
          <InitialTile {...args} name={name} />
          <span className="text-caption text-ink-muted">
            {name} · tone {toneOf(name)}
          </span>
        </li>
      ))}
    </ul>
  ),
};

/** Give the seed an id, not the name: the entity is renamed, and its tile keeps its tone. Both tiles below share the seed `org_1`. */
export const SeededByAnId: Story = {
  render: (args) => (
    <div className="flex items-center gap-4">
      <InitialTile {...args} name="Studio Nord" seed="org_1" />
      <span className="text-ink-muted">renamed</span>
      <InitialTile {...args} name="Nord Architecture" seed="org_1" />
    </div>
  ),
};

/** Two letters at most, however long the name, and the tile never shrinks: beside a long name, the name wraps. */
export const LongName: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-56">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <div className="flex items-center gap-3">
      <InitialTile {...args} name="Anne-Charlotte de Montmorency-Laval" />
      <p className="min-w-0 text-body font-medium wrap-break-word">
        Anne-Charlotte de Montmorency-Laval
      </p>
    </div>
  ),
};

/** A name that is one word gives one letter. The tile is a picture, hidden from assistive technology: the name next to it is what says who it is. */
export const OneWord: Story = {
  args: { name: "Acme" },
};
