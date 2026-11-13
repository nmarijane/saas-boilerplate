import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CopyIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { fn } from "storybook/test";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { TabLinks } from "@/shared/components/ui/tab-links";
import { EntityHeader } from "./entity-header";

/** The tabs read the route, and Storybook has none: each story says where it is. */
const at = (pathname: string) => ({
  nextjs: { appDirectory: true, navigation: { pathname } },
});

const meta = {
  title: "Data/EntityHeader",
  component: EntityHeader,
  tags: ["autodocs"],
  argTypes: {
    breadcrumb: { control: "object" },
    meta: { control: false },
    primaryAction: { control: false },
    moreActions: { control: false },
    tabs: { control: false },
  },
  args: {
    breadcrumb: [
      { label: "Projects", href: "/projects" },
      { label: "Website redesign" },
    ],
    title: "Website redesign",
    description: "Rebuild the marketing site on the new design system.",
    meta: (
      <Badge variant="success" dot>
        Active
      </Badge>
    ),
    primaryAction: <Button>Share</Button>,
    moreActions: [
      { label: "Rename", icon: PencilIcon, onSelect: fn() },
      { label: "Duplicate", icon: CopyIcon, onSelect: fn() },
      {
        label: "Delete project",
        icon: Trash2Icon,
        onSelect: fn(),
        destructive: true,
      },
    ],
    tabs: (
      <TabLinks
        label="Project"
        items={[
          { href: "/projects/p1", label: "Overview", exact: true },
          { href: "/projects/p1/settings", label: "Settings" },
        ]}
      />
    ),
  },
  parameters: at("/projects/p1"),
  decorators: [
    (Story) => (
      <div className="max-w-5xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EntityHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The page of a thing that lives in a list: the trail that leads to it, its name as the one h1 (24 px, bold), a short description with its meta, the one button and the « ⋯ » menu, then the tabs. The last crumb is the current page and not a link. It is the other family of headers, next to `PageHeader`: the two never mix on a page. */
export const Complete: Story = {};

/** The same entity on its settings tab: the tabs follow the route. */
export const OnAnotherTab: Story = {
  parameters: at("/projects/p1/settings"),
};

/** A trail of three, with no tabs and no menu. */
export const DeepTrail: Story = {
  args: {
    breadcrumb: [
      { label: "Projects", href: "/projects" },
      { label: "Studio Nord", href: "/projects/nord" },
      { label: "Website redesign" },
    ],
    moreActions: [],
    tabs: undefined,
  },
};

/** Only the trail and the name: no description, no meta, no action, no tabs. */
export const WithoutActions: Story = {
  args: {
    description: undefined,
    meta: undefined,
    primaryAction: undefined,
    moreActions: [],
    tabs: undefined,
  },
};

/**
 * French runs longer, and a name does not break: a word wider than the column
 * wraps inside it, the trail wraps and its last crumb is cut to one line, the
 * actions fall under the title, and nothing leaves the row. Look at it at 320
 * px, and open the menu.
 */
export const LongTitle: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-72">
        <Story />
      </div>
    ),
  ],
  args: {
    breadcrumb: [
      { label: "Projets", href: "/projects" },
      { label: "Studio Nord Architecture et Design", href: "/projects/nord" },
      { label: "Refonte du site vitrine 2026 avec le nouveau système" },
    ],
    title: "Refonte du site vitrine 2026 avec le nouveau système graphique",
    description:
      "Reconstruire le site marketing, de la page d'accueil jusqu'à RefonteDuSiteVitrine2026 et aux pages de tarifs.",
    meta: <Badge variant="warning">En attente de validation</Badge>,
    primaryAction: <Button>Partager avec l'équipe</Button>,
    moreActions: [
      { label: "Renommer le projet", icon: PencilIcon, onSelect: fn() },
      {
        label: "Supprimer définitivement le projet",
        icon: Trash2Icon,
        onSelect: fn(),
        destructive: true,
      },
    ],
  },
};
