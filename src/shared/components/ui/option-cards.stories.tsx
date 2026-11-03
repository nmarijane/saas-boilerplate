import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BuildingIcon, SparklesIcon, UsersIcon } from "lucide-react";
import * as React from "react";
import { fn } from "storybook/test";

import { OptionCards } from "./option-cards";

type Props = React.ComponentProps<typeof OptionCards<string>>;

/** Keeps the value, as the page that uses the cards would, and reports each change. */
function Controlled({ value: initial, onValueChange, ...props }: Props) {
  const [value, setValue] = React.useState(initial);

  return (
    <OptionCards
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
  title: "UI/OptionCards",
  component: OptionCards,
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
} satisfies Meta<typeof OptionCards<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Real radio buttons: Tab enters the group, the arrows change the choice. */
export const Default: Story = {
  args: {
    name: "plan",
    label: "Plan",
    options: [
      {
        value: "solo",
        label: "Solo",
        description: "For one person, with every feature.",
        icon: SparklesIcon,
      },
      {
        value: "team",
        label: "Team",
        description: "Shared projects and roles, billed per seat.",
        icon: UsersIcon,
      },
      {
        value: "company",
        label: "Company",
        description: "Single sign-on and an audit log.",
        icon: BuildingIcon,
      },
    ],
    value: "team",
  },
};

export const WithoutIcons: Story = {
  args: {
    name: "delivery",
    label: "Delivery",
    options: [
      {
        value: "email",
        label: "By email",
        description: "A summary every Monday.",
      },
      { value: "slack", label: "In Slack", description: "As it happens." },
    ],
    value: "email",
  },
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    name: "plan-disabled",
    disabled: true,
  },
};

/** French labels and descriptions in a narrow column: the cards stack and the text wraps. */
export const LongLabel: Story = {
  args: {
    name: "acces",
    label: "Accès",
    options: [
      {
        value: "equipe",
        label: "Accès pour toute l'équipe de l'espace de travail",
        description:
          "Chaque membre voit les projets partagés et peut les modifier selon son rôle.",
        icon: UsersIcon,
      },
      {
        value: "prive",
        label: "Accès réservé aux administrateurs",
        description:
          "Seuls les propriétaires et les administrateurs peuvent ouvrir ce projet.",
        icon: BuildingIcon,
      },
    ],
    value: "equipe",
  },
  decorators: [
    (Story) => (
      <div className="w-72 max-w-full">
        <Story />
      </div>
    ),
  ],
};
