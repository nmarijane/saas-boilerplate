import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps } from "react";

import { Button } from "./button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

const sides = ["right", "left", "top", "bottom"] as const;

type Props = ComponentProps<typeof SheetContent>;

/** A sheet that is open when the story loads; its trigger opens it again once closed. */
function Example({ children, ...props }: Props) {
  return (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button variant="outline">Open sheet</Button>
      </SheetTrigger>
      <SheetContent {...props}>{children}</SheetContent>
    </Sheet>
  );
}

const meta = {
  title: "UI/Sheet",
  component: SheetContent,
  tags: ["autodocs"],
  argTypes: {
    side: {
      control: "inline-radio",
      options: sides,
    },
  },
  // While a sheet is open, Radix hides the page (the trigger included) from
  // assistive technology and traps the focus in the sheet: the trigger cannot
  // be reached, which axe cannot tell.
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<typeof SheetContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The overlay is the scrim of the theme. The corner button is the one of the dialog: a 44 px target, in muted ink. */
export const Right: Story = {
  args: {
    side: "right",
    children: (
      <SheetHeader>
        <SheetTitle>Filters</SheetTitle>
        <SheetDescription>Narrow the list to what you need.</SheetDescription>
      </SheetHeader>
    ),
  },
};

/** As the mobile menu of the sidebar uses it. */
export const Left: Story = {
  args: {
    side: "left",
    className: "w-64 p-0",
    children: (
      <SheetHeader className="p-4">
        <SheetTitle>Menu</SheetTitle>
        <SheetDescription className="sr-only">Pages of the app</SheetDescription>
      </SheetHeader>
    ),
  },
};
