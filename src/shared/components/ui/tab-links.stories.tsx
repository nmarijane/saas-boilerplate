import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TabLinks } from "./tab-links";

const settings = [
  { href: "/settings/account", label: "Account" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/developers", label: "Developers" },
  { href: "/settings/notifications", label: "Notifications" },
];

/** TabLinks reads the route, and Storybook has none: each story says where it is. */
const at = (pathname: string) => ({
  nextjs: { appDirectory: true, navigation: { pathname } },
});

const meta = {
  title: "UI/TabLinks",
  component: TabLinks,
  tags: ["autodocs"],
  args: { label: "Settings", items: settings },
  parameters: at("/settings/team"),
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TabLinks>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The settings of the app: one link per page, the current one in ink with a line under it and `aria-current="page"`. The tabs look as `Tabs` does, but each is a page of its own, so this is a navigation and not a tab list. */
export const Settings: Story = {};

/** A tab stays the current one on the pages under it: here the invitations of the team. */
export const UnderTheCurrentPage: Story = {
  parameters: at("/settings/team/invitations"),
};

/** The overview of an entity is `exact`: it is the current tab on its own page only, and not on the pages of the tabs under it. */
export const ExactOverview: Story = {
  args: {
    label: "Project",
    items: [
      { href: "/projects/p1", label: "Overview", exact: true },
      { href: "/projects/p1/settings", label: "Settings" },
    ],
  },
  parameters: at("/projects/p1"),
};

/** The same tabs on the settings page of the project: the overview is no longer the current one. */
export const ExactOverviewElsewhere: Story = {
  args: ExactOverview.args,
  parameters: at("/projects/p1/settings"),
};

/** On no page of the list, no tab is current. */
export const NoCurrentTab: Story = {
  parameters: at("/dashboard"),
};

/**
 * French runs longer, and the tabs never shrink: in a box as narrow as a phone
 * (320 px), the strip scrolls sideways, with no scrollbar. The page opens on the
 * last tab, which the strip brings into view; click another one, and the strip
 * brings that one into view in turn.
 */
export const LongLabels: Story = {
  args: {
    label: "Réglages",
    items: [
      { href: "/settings/account", label: "Compte et profil" },
      { href: "/settings/team", label: "Équipe et invitations" },
      { href: "/settings/billing", label: "Abonnement et factures" },
      { href: "/settings/developers", label: "Clés d'API et webhooks" },
      { href: "/settings/notifications", label: "Notifications et alertes" },
    ],
  },
  parameters: at("/settings/notifications"),
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
};
