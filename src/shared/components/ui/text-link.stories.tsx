import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowRightIcon } from "lucide-react";

import { TextLink } from "./text-link";

const intents = ["default", "muted", "danger"] as const;
const underlines = ["always", "hover"] as const;

const meta = {
  title: "UI/TextLink",
  component: TextLink,
  tags: ["autodocs"],
  argTypes: {
    intent: {
      control: "inline-radio",
      options: intents,
    },
    underline: {
      control: "inline-radio",
      options: underlines,
    },
  },
  args: { href: "#" },
} satisfies Meta<typeof TextLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Read the docs" },
};

export const Muted: Story = {
  args: { children: "Skip for now", intent: "muted" },
};

export const Danger: Story = {
  args: { children: "Delete this project", intent: "danger" },
};

export const UnderlineOnHover: Story = {
  args: { children: "Pricing", underline: "hover" },
};

/** Every intent, with the underline at rest and on hover only. */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {underlines.map((underline) => (
        <div key={underline} className="flex flex-wrap items-center gap-6">
          {intents.map((intent) => (
            <TextLink
              key={intent}
              href="#"
              intent={intent}
              underline={underline}
            >
              {intent}
            </TextLink>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        View plans
        <ArrowRightIcon />
      </>
    ),
  },
};

/** Inside a sentence, a link wraps with the words around it, however long. */
export const InSentence: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose">
        Your plan renews on the first of the month. You can change it at any
        time from <TextLink href="#">the billing page</TextLink>, or{" "}
        <TextLink href="#" intent="muted">
          compare the plans
        </TextLink>{" "}
        first.
      </p>
      <p className="max-w-64">
        Before you continue, read{" "}
        <TextLink href="#">
          the full terms of service and the data processing agreement
        </TextLink>{" "}
        that apply to your workspace.
      </p>
    </div>
  ),
};

/**
 * A link on a line of its own, outside a sentence, asks for a 44 px target with
 * `className="tap-target"`. The dashed box is that target: a page does not draw
 * it. Inside a sentence a link keeps the height of its words, with no class.
 */
export const Standalone: Story = {
  args: { children: "Back to all projects", className: "tap-target" },
  decorators: [
    (Story) => (
      <div className="py-3 [&_a::before]:outline-1 [&_a::before]:outline-dashed [&_a::before]:outline-control">
        <Story />
      </div>
    ),
  ],
};

/** The link of your router (a locale-aware Link, for instance) wears the style. */
export const AsChild: Story = {
  render: () => (
    <TextLink asChild>
      <a href="#billing">Go to billing</a>
    </TextLink>
  ),
};

/** A long French label in a narrow column: the link wraps inside it. */
export const LongLabel: Story = {
  render: () => (
    <div className="max-w-48">
      <TextLink href="#">Enregistrer les modifications du profil</TextLink>
    </div>
  ),
};
