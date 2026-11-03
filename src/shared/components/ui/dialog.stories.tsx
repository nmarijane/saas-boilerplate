import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";

import { Button } from "./button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Field } from "./field";
import { Input } from "./input";

const sizes = ["sm", "md", "lg"] as const;

const paragraphs = Array.from({ length: 12 }, (_, n) => `paragraph-${n}`);

type Props = React.ComponentProps<typeof DialogContent>;

/** A dialog that is open when the story loads; its trigger opens it again once closed. */
function Example({ children, ...props }: Props) {
  return (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="outline">Open dialog</Button>
      </DialogTrigger>
      <DialogContent {...props}>{children}</DialogContent>
    </Dialog>
  );
}

const meta = {
  title: "UI/Dialog",
  component: DialogContent,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "inline-radio",
      options: sizes,
    },
    showCloseButton: {
      control: "boolean",
    },
  },
  // While a dialog is open, Radix hides the page (the trigger included) from
  // assistive technology and traps the focus in the dialog: the trigger cannot
  // be reached, which axe cannot tell.
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<typeof DialogContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 560 px wide: forms and most content. The size is a control. */
export const Default: Story = {
  args: {
    size: "md",
    children: (
      <>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>
            The name shows in the sidebar and in invitations.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="Name" htmlFor="project-name">
            <Input id="project-name" defaultValue="Website relaunch" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Save</Button>
        </DialogFooter>
      </>
    ),
  },
};

/** 420 px wide: a short question, or a notice. */
export const Small: Story = {
  args: {
    size: "sm",
    children: (
      <>
        <DialogHeader>
          <DialogTitle>Leave this page?</DialogTitle>
          <DialogDescription>
            You have changes that are not saved yet.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Stay</Button>
          </DialogClose>
          <Button>Leave</Button>
        </DialogFooter>
      </>
    ),
  },
};

/** 1 080 px wide: a choice between cards, a comparison, a preview. */
export const Large: Story = {
  args: {
    size: "lg",
    children: (
      <>
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>
            The new price applies from your next invoice.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="md:grid md:grid-cols-3">
          {["Starter", "Team", "Scale"].map((name) => (
            <div
              key={name}
              className="flex flex-col gap-1 rounded-lg border border-hairline p-4"
            >
              <p className="text-section text-ink">{name}</p>
              <p className="text-ink-muted">
                Everything in the plan before it, and more room to grow.
              </p>
            </div>
          ))}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Continue</Button>
        </DialogFooter>
      </>
    ),
  },
};

/** Without the corner button: for a dialog whose footer is the only way out. */
export const WithoutCloseButton: Story = {
  args: {
    size: "sm",
    showCloseButton: false,
    children: (
      <>
        <DialogHeader className="pr-0">
          <DialogTitle>Session expired</DialogTitle>
          <DialogDescription>
            Sign in again to keep working. Your draft is saved.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Sign in</Button>
          </DialogClose>
        </DialogFooter>
      </>
    ),
  },
};

/** French runs longer: the title wraps clear of the corner button, the footer buttons stack, and a tall dialog scrolls inside the viewport. */
export const LongContent: Story = {
  args: {
    size: "md",
    children: (
      <>
        <DialogHeader>
          <DialogTitle>
            Conditions d'utilisation de l'espace de travail partagé
          </DialogTitle>
          <DialogDescription>
            Lisez attentivement ce qui suit avant d'inviter des personnes
            extérieures à votre organisation.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {paragraphs.map((id) => (
            <p key={id}>
              Chaque membre invité peut consulter les projets de l'espace, y
              ajouter des fichiers et en modifier le contenu, jusqu'à ce qu'un
              administrateur retire son accès depuis la page des membres.
            </p>
          ))}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Relire plus tard</Button>
          </DialogClose>
          <Button>J'ai compris, inviter des personnes</Button>
        </DialogFooter>
      </>
    ),
  },
};
