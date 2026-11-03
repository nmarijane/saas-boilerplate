import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  CopyIcon,
  DownloadIcon,
  FolderIcon,
  HouseIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import { fn, userEvent, within } from "storybook/test";

import { Button } from "@/shared/components/ui/button";
import { PageAlert } from "@/shared/components/ui/page-alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { PageHeader } from "./page-header";

const meta = {
  title: "Data/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  argTypes: {
    icon: { control: false },
    illustration: { control: false },
    context: { control: "text" },
    primaryAction: { control: false },
    moreActions: { control: false },
    alert: { control: false },
    tabs: { control: false },
    actions: { control: false },
  },
  args: {
    icon: HouseIcon,
    title: "Welcome back, Camille",
    context: "Studio Nord · Pro plan",
    primaryAction: (
      <Button>
        <PlusIcon />
        New project
      </Button>
    ),
    moreActions: [
      { label: "Invite teammates", icon: UserPlusIcon, onSelect: fn() },
      { label: "Download report", icon: DownloadIcon, onSelect: fn() },
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-5xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A tile, the title with its context line, one primary action and the « ⋯ » menu for the others. The label of the « ⋯ » button comes from the locales: switch the language in the toolbar. */
export const Home: Story = {};

/** One alert under the header. A warning interrupts assistive technology (`role="alert"`) and sits in the flow of the page. */
export const WithAlert: Story = {
  args: {
    alert: (
      <PageAlert
        tone="warning"
        title="You have used 82 % of your AI credits"
        action={
          <Button size="sm" variant="outline">
            See plans
          </Button>
        }
      >
        Upgrade before the end of the month to keep using AI chat.
      </PageAlert>
    ),
  },
};

/** The page holds the `Tabs` and the header holds their list: the tabs sit under the title, under the alert when there is one, and the content below follows the active tab. */
export const WithTabs: Story = {
  render: (args) => (
    <Tabs defaultValue="overview">
      <PageHeader
        {...args}
        tabs={
          <TabsList aria-label="Workspace sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>
        }
      />
      <TabsContent value="overview">
        <p className="text-ink-soft">The summary of the workspace.</p>
      </TabsContent>
      <TabsContent value="members">
        <p className="text-ink-soft">Who can see and edit the workspace.</p>
      </TabsContent>
      <TabsContent value="billing">
        <p className="text-ink-soft">The plan, the invoices and the card.</p>
      </TabsContent>
    </Tabs>
  ),
};

/** The pages written before the rebuild pass `description` and `actions`: they read as the context and the primary action, with no tile, and need no change. New pages use `context` and `primaryAction`. */
export const Legacy: Story = {
  render: () => (
    <PageHeader
      title="Settings"
      description="Manage your account and your preferences."
      actions={<Button variant="outline">Export</Button>}
    />
  ),
};

/** The other actions open from the « ⋯ » button, in the order given. A destructive one comes last, after a separator, wherever it was given. The story opens the menu when it loads: arrow keys move through the rows. */
export const MenuOpen: Story = {
  // While the menu is open, Radix hides the page (the trigger included) from
  // assistive technology and traps the focus in the menu, which axe cannot tell.
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  decorators: [
    (Story) => (
      <div className="min-h-72">
        <Story />
      </div>
    ),
  ],
  args: {
    icon: FolderIcon,
    title: "Website redesign",
    context: "Studio Nord · Updated 2 days ago",
    primaryAction: <Button>Share</Button>,
    moreActions: [
      { label: "Delete project", icon: Trash2Icon, onSelect: fn(), destructive: true },
      { label: "Rename", icon: PencilIcon, onSelect: fn() },
      { label: "Duplicate", icon: CopyIcon, onSelect: fn() },
    ],
  },
  play: async ({ canvasElement }) => {
    // « More actions » or « Autres actions », whichever language is on.
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: /actions/i }),
    );
  },
};

// Art a project supplies, drawn with the theme tokens so that it follows the
// dark theme and a new brand like everything else. It carries no label: the
// header hides it from assistive technology, as it is decoration.
function WorkspaceIllustration() {
  return (
    <svg viewBox="0 0 56 56" fill="none" className="size-14">
      <rect width="56" height="56" rx="14" className="fill-brand-tint" />
      <rect
        x="11"
        y="13"
        width="26"
        height="30"
        rx="6"
        strokeWidth="2"
        className="fill-surface stroke-hairline"
      />
      <rect x="17" y="21" width="14" height="4" rx="2" className="fill-track" />
      <rect x="17" y="29" width="10" height="3" rx="1.5" className="fill-hairline" />
      <circle cx="38" cy="38" r="9" className="fill-brand" />
      <path
        d="M38 33.5v9M33.5 38h9"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="stroke-brand-on"
      />
    </svg>
  );
}

/** An illustration stands where the tile would, and wins when both are given. It is decoration by contract, so the header hides it from assistive technology. */
export const WithIllustration: Story = {
  args: {
    illustration: <WorkspaceIllustration />,
  },
};

/** French runs longer, and a name does not break: a word wider than the column wraps inside it, the actions fall under the title, and nothing leaves the row. Look at it at 320 px, where the tile is 40 px and the title 20 px, and open the menu. */
export const LongText: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-72">
        <Story />
      </div>
    ),
  ],
  args: {
    title: "Bienvenue, Anne-Charlotte de Montmorency-Laval",
    context:
      "Studio Nord Architecture et Design RefonteDuSiteVitrine2026 · Offre Pro annuelle",
    primaryAction: (
      <Button>
        <PlusIcon />
        Nouveau projet
      </Button>
    ),
    moreActions: [
      {
        label: "Inviter des collègues dans l’espace de travail",
        icon: UserPlusIcon,
        onSelect: fn(),
      },
      {
        label: "Télécharger le rapport mensuel complet",
        icon: DownloadIcon,
        onSelect: fn(),
      },
    ],
  },
};
