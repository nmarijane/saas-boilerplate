import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import { FolderIcon, UsersIcon, ZapIcon } from "lucide-react";

import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { IconTile } from "./icon-tile";

const meta = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// One column, as a card sits in a settings page.
const narrow: Decorator[] = [
  (Story) => (
    <div className="max-w-sm">
      <Story />
    </div>
  ),
];

/** A title, a line under it and the content: 20 px in from the edge, 16 px between the parts. */
export const Simple: Story = {
  decorators: narrow,
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <CardDescription>Four people can edit this workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-body">Invite a colleague to share your projects.</p>
      </CardContent>
    </Card>
  ),
};

/** A card that is a section of the page takes the heading it needs with `as`, here a level 2: the look does not change, the structure does. The default stays a div, for a card that is only a block. */
export const TitleAsHeading: Story = {
  decorators: narrow,
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Profile</CardTitle>
        <CardDescription>
          Shown to the people of your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-body">Camille Laurent</p>
      </CardContent>
    </Card>
  ),
};

/** One main button per zone: the other action stays quiet. */
export const WithFooter: Story = {
  decorators: narrow,
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Workspace name</CardTitle>
        <CardDescription>Shown to everyone you invite.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-body">Studio Nord</p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </CardFooter>
    </Card>
  ),
};

/** A rule pads by the gap, so that it sits midway between the two parts. */
export const WithRules: Story = {
  decorators: narrow,
  render: () => (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Invoices</CardTitle>
        <CardDescription>Paid on the first of the month.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-body">November: $29.00</p>
      </CardContent>
      <CardFooter className="justify-end border-t">
        <Button variant="outline">Download all</Button>
      </CardFooter>
    </Card>
  ),
};

/** A caller's class wins: a danger zone changes its edge, and nothing else. */
export const CustomEdge: Story = {
  decorators: narrow,
  render: () => (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle>Delete the workspace</CardTitle>
        <CardDescription>This cannot be undone.</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="destructive">Delete</Button>
      </CardFooter>
    </Card>
  ),
};

const usage = [
  { icon: FolderIcon, tone: "t1", name: "Projects", figure: "12 of 50" },
  { icon: UsersIcon, tone: "t3", name: "Members", figure: "4 of 10" },
  { icon: ZapIcon, tone: "t2", name: "AI credits", figure: "4,120 of 5,000" },
] as const;

/** A handful of items reads better as cards than as a table. */
export const CardsInsteadOfATable: Story = {
  render: () => (
    <ul className="grid max-w-3xl gap-4 sm:grid-cols-3">
      {usage.map(({ icon, tone, name, figure }) => (
        <li key={name} className="flex">
          <Card className="flex-1">
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <IconTile icon={icon} tone={tone} />
                <CardTitle>{name}</CardTitle>
              </div>
              <p className="font-mono text-body tabular-nums">{figure}</p>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  ),
};

/** French runs longer: the card grows, nothing is cut. */
export const LongText: Story = {
  decorators: narrow,
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Invitation de votre équipe au complet</CardTitle>
        <CardDescription>
          Chaque personne invitée reçoit un lien valable sept jours pour
          rejoindre l'espace de travail de votre studio.
        </CardDescription>
      </CardHeader>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline">Annuler</Button>
        <Button>Envoyer les invitations</Button>
      </CardFooter>
    </Card>
  ),
};
