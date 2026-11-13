import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ChevronRightIcon,
  FolderIcon,
  KeyRoundIcon,
  ReceiptIcon,
  SendIcon,
  UserPlusIcon,
} from "lucide-react";

import { Badge } from "./badge";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { IconTile } from "./icon-tile";
import { List, ListRow } from "./list";
import { StatusDot } from "./status-dot";

const meta = {
  title: "UI/List",
  component: List,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

// A story must not leave the page when a row is followed.
const stayHere: Decorator = (Story) => (
  <div
    onClickCapture={(event) => {
      if ((event.target as HTMLElement).closest("a")) {
        event.preventDefault();
      }
    }}
  >
    <Story />
  </div>
);

/** Four lines of activity: a tile, a sentence and a moment. In a card, the rows line up with the title. */
export const Activity: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <List>
          <ListRow
            leading={<IconTile icon={UserPlusIcon} size="sm" tone="t4" />}
            title="Léa Martin joined the team"
            trailing="1 h ago"
          />
          <ListRow
            leading={<IconTile icon={ReceiptIcon} size="sm" tone="t2" />}
            title="November invoice paid"
            trailing={<span className="font-mono tabular-nums">$29.00</span>}
          />
          <ListRow
            leading={<IconTile icon={SendIcon} size="sm" tone="t3" />}
            title="Project Orbit published"
            trailing="Yesterday"
          />
          <ListRow
            leading={<IconTile icon={KeyRoundIcon} size="sm" tone="t1" />}
            title="API key Production created"
            trailing="Mon"
          />
        </List>
      </CardContent>
    </Card>
  ),
};

/** The whole row is the link: hover lights it, and the keyboard focus draws the ring of the system. */
export const Linked: Story = {
  decorators: [stayHere],
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
      </CardHeader>
      <CardContent>
        <List>
          <ListRow
            href="/projects/atlas"
            leading={<IconTile icon={FolderIcon} tone="t1" />}
            title="Atlas"
            meta={<StatusDot tone="success" label="Online" />}
            trailing={
              <ChevronRightIcon aria-hidden="true" className="size-4" />
            }
          />
          <ListRow
            href="/projects/orbit"
            leading={<IconTile icon={FolderIcon} tone="t2" />}
            title="Orbit"
            meta={<StatusDot tone="success" label="Online" />}
            trailing={
              <ChevronRightIcon aria-hidden="true" className="size-4" />
            }
          />
          <ListRow
            href="/projects/relay"
            leading={<IconTile icon={FolderIcon} tone="t4" />}
            title="Relay"
            meta={<StatusDot tone="neutral" label="Draft" />}
            trailing={
              <ChevronRightIcon aria-hidden="true" className="size-4" />
            }
          />
        </List>
      </CardContent>
    </Card>
  ),
};

/** A title and a line under it, with a badge at the end. */
export const WithMeta: Story = {
  render: () => (
    <Card>
      <CardContent>
        <List>
          <ListRow
            leading={<IconTile icon={UserPlusIcon} tone="brand" />}
            title="camille@example.com"
            meta="Invited 2 days ago"
            trailing={<Badge variant="neutral">Pending</Badge>}
          />
          <ListRow
            leading={<IconTile icon={UserPlusIcon} tone="success" />}
            title="lea@example.com"
            meta="Joined on Monday"
            trailing={<Badge variant="success">Active</Badge>}
          />
        </List>
      </CardContent>
    </Card>
  ),
};

/** A list outside a card keeps the hairlines between its rows. */
export const OnThePage: Story = {
  render: () => (
    <List>
      <ListRow title="General" trailing="Updated today" />
      <ListRow title="Billing" trailing="Updated last week" />
      <ListRow title="Security" trailing="Never updated" />
    </List>
  ),
};

/** French runs longer: the title wraps, and the end of the row keeps its width. */
export const LongText: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-72">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Card>
      <CardContent>
        <List>
          <ListRow
            leading={<IconTile icon={ReceiptIcon} size="sm" tone="t2" />}
            title="La facture de novembre de votre studio a été réglée"
            meta="Par carte bancaire, le 1er novembre"
            trailing={<span className="font-mono tabular-nums">29,00 $</span>}
          />
          <ListRow
            leading={<IconTile icon={UserPlusIcon} size="sm" tone="t4" />}
            title="lea.martin.studio-nord@example.com"
            trailing="Il y a 1 h"
          />
        </List>
      </CardContent>
    </Card>
  ),
};
