import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import type { ShellLink, ShellView } from "@/shared/shell/view";
import {
  BellIcon,
  BotIcon,
  BuildingIcon,
  ChartColumnIcon,
  ChevronsUpDownIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  FolderIcon,
  HouseIcon,
  MessageSquareIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { MINIMAL_VIEWPORTS } from "storybook/viewport";

import { PageHeader } from "@/shared/components/data/page-header";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { InitialTile } from "@/shared/components/ui/initial-tile";
import { toast, Toaster } from "@/shared/components/ui/sonner";
import { AppShell } from "./app-shell";
import { navRowStyles } from "./nav-row";

// The shell is presentational: it takes a view and the slots that features fill.
// Here the view is made by hand, its icons drawn as elements (as the server hands
// them over), and the slots are plain buttons: no feature, no action, no server
// module is imported. Where the page is, and how wide the screen is, are
// parameters of each story.

/** The shell reads the route, and Storybook has none: each story says where it is. */
const at = (pathname: string) => ({
  nextjs: { appDirectory: true, navigation: { pathname } },
});

/** The shell changes with the width of the screen: each story picks one of Storybook's viewports. */
const onScreen = (value: string) => ({
  viewport: { value, isRotated: false },
});

/** The viewports of Storybook, and a phone as wide as the one the French labels have to fit. */
const VIEWPORTS = {
  ...MINIMAL_VIEWPORTS,
  phone: {
    name: "Phone (390 px)",
    styles: { width: "390px", height: "844px" },
    type: "mobile",
  },
} as const;

function link(
  id: string,
  href: string,
  label: string,
  Icon: LucideIcon,
  match?: string,
): ShellLink {
  return {
    id,
    href,
    label,
    icon: <Icon aria-hidden="true" />,
    ...(match !== undefined && { match }),
  };
}

const WORKSPACE = {
  id: "org_1",
  name: "Studio Nord",
  role: "owner",
  plan: "Pro",
} as const;

const VIEW: ShellView = {
  productName: "Orbit",
  user: {
    id: "user_1",
    name: "Camille Laurent",
    email: "camille@example.com",
    image: null,
    isPlatformAdmin: false,
  },
  workspace: WORKSPACE,
  workspaces: [WORKSPACE],
  nav: {
    main: [
      link("home", "/dashboard", "Home", HouseIcon),
      link("projects", "/projects", "Projects", FolderIcon),
      link("assistant", "/ai", "Assistant", BotIcon),
    ],
    secondary: [
      link(
        "settings",
        "/settings/account",
        "Settings",
        SlidersHorizontalIcon,
        "/settings",
      ),
      link("help", "mailto:support@example.com", "Help", CircleHelpIcon),
    ],
    admin: [],
  },
  account: [],
  settings: [],
  quotas: [],
};

/** Five pages in the main navigation, one more than a tab bar has room for: the fifth is behind More. */
const FIVE_PAGES: ShellView = {
  ...VIEW,
  nav: {
    ...VIEW.nav,
    main: [
      ...VIEW.nav.main,
      link("reports", "/reports", "Reports", ChartColumnIcon),
      link("people", "/people", "People", UsersIcon),
    ],
  },
};

const ADMIN_LINKS = [
  link("users", "/admin/users", "Users", UsersIcon),
  link("organizations", "/admin/organizations", "Organizations", BuildingIcon),
  link("metrics", "/admin/metrics", "Metrics", ChartColumnIcon),
  link("audit", "/admin/audit", "Audit log", ClipboardListIcon),
];

// The slots, as a feature would fill them, drawn by hand: a workspace switcher
// (a bordered row, a tile, the plan under the name), the account menu, the bell
// and the rows of the sidebar actions.
function FakeWorkspaceSwitcher({
  name = "Studio Nord",
  plan = "Pro plan",
}: {
  name?: string;
  plan?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-haspopup="dialog"
      className="h-auto min-h-13 w-full justify-start gap-2.5 p-2 text-left"
    >
      <InitialTile name={name} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <span className="truncate">{name}</span>
        <span className="truncate text-caption font-normal text-ink-muted">
          {plan}
        </span>
      </span>
      <ChevronsUpDownIcon aria-hidden="true" className="text-ink-muted" />
    </Button>
  );
}

function FakeCreateWorkspace() {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto min-h-13 w-full justify-start gap-2.5 p-2 text-left"
    >
      <PlusIcon aria-hidden="true" />
      Create workspace
    </Button>
  );
}

function FakeAccountMenu({
  name = "Camille Laurent",
  role = "Owner",
}: {
  name?: string;
  role?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-haspopup="menu"
      className="h-auto min-h-13 w-full justify-start gap-2.5 p-2 text-left"
    >
      <InitialTile name={name} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <span className="truncate">{name}</span>
        <span className="truncate text-caption font-normal text-ink-muted">
          {role}
        </span>
      </span>
      <ChevronsUpDownIcon aria-hidden="true" className="text-ink-muted" />
    </Button>
  );
}

function FakeBell() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Notifications: 2 unread"
      aria-haspopup="dialog"
    >
      <BellIcon aria-hidden="true" />
    </Button>
  );
}

function FakeFeedbackRow({ label = "Send feedback" }: { label?: string }) {
  return (
    <button type="button" className={navRowStyles}>
      <MessageSquareIcon aria-hidden="true" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function FakePage({ title = "Welcome back, Camille" }: { title?: string }) {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={HouseIcon}
        title={title}
        context="Studio Nord · Pro plan"
        primaryAction={<Button>New project</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["Projects", "Members", "Storage", "Credits", "Invoices", "Alerts"].map(
          (name) => (
            <Card key={name}>
              <CardHeader>
                <CardTitle as="h2">{name}</CardTitle>
              </CardHeader>
              <CardContent className="text-ink-muted">
                A card of the page, to give the sticky bars something to scroll
                over.
              </CardContent>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}

/**
 * Presses the control that opens the drawer, and hands back the page, that
 * control and the drawer that opened. The drawer is drawn in a portal under the
 * body, so it is looked for there and not in the canvas; and the control is taken
 * before it opens, since the page behind a modal is hidden from the queries.
 */
async function openDrawer(canvasElement: HTMLElement, control: string) {
  const page = within(canvasElement.ownerDocument.body);
  const opener = page.getByRole("button", { name: control });

  await userEvent.click(opener);
  const dialog = await page.findByRole("dialog", { name: "Menu" });

  return { page, opener, dialog };
}

const meta = {
  title: "Shell/AppShell",
  component: AppShell,
  argTypes: {
    view: { control: "object" },
    workspaceSwitcher: { control: false },
    accountMenu: { control: false },
    notifications: { control: false },
    sidebarActions: { control: false },
    children: { control: false },
  },
  args: {
    view: VIEW,
    workspaceSwitcher: <FakeWorkspaceSwitcher />,
    accountMenu: <FakeAccountMenu />,
    notifications: <FakeBell />,
    sidebarActions: <FakeFeedbackRow />,
    children: <FakePage />,
  },
  parameters: {
    layout: "fullscreen",
    viewport: { options: VIEWPORTS },
    ...at("/projects"),
  },
  // The shell fills the screen: the padding the preview puts around a story would only push it in.
  decorators: [
    (Story) => (
      <div className="-m-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** From 1024 px: a sidebar of 248 px with the logo and the bell, the workspace, the pages, Settings and Help with the actions of the features, and the account at the foot. The current page has an accent background. */
export const Desktop: Story = {
  globals: onScreen("desktop"),
};

/** From 480 to 1024 px there is no sidebar: a header with a Menu button, the logo and the bell. */
export const Tablet: Story = {
  globals: onScreen("tablet"),
};

/** The same width with the drawer open from the left: the sidebar's column, in a sheet, named Menu for assistive technology. */
export const TabletMenuOpen: Story = {
  globals: onScreen("tablet"),
  play: async ({ canvasElement }) => {
    const { dialog } = await openDrawer(canvasElement, "Menu");

    await expect(dialog).toBeVisible();
    await expect(
      within(dialog).getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
  },
};

/** Escape closes the drawer, and the focus is back on Menu, the control that opened it: it is not lost on the page. */
export const MenuClosesWithEscape: Story = {
  globals: onScreen("tablet"),
  play: async ({ canvasElement }) => {
    const { page, opener } = await openDrawer(canvasElement, "Menu");

    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(page.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(opener).toHaveFocus());
  },
};

/** A click on a link of the drawer closes it. */
export const MenuClosesOnNavigate: Story = {
  globals: onScreen("tablet"),
  play: async ({ canvasElement }) => {
    const { page, dialog } = await openDrawer(canvasElement, "Menu");

    await userEvent.click(
      within(dialog).getByRole("link", { name: "Assistant" }),
    );

    await waitFor(() =>
      expect(page.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};

/**
 * A shell whose workspace switcher is a button that changes the workspace of the
 * view, as the answer of the server does once a switch is made. The route does
 * not change: a switch pushes the home, which is where the person may already be.
 */
function SwitchingShell(props: ComponentProps<typeof AppShell>) {
  const [view, setView] = useState(props.view);
  const other = { id: "org_2", name: "Atelier Sud", role: "admin", plan: "Team" } as const;

  return (
    <AppShell
      {...props}
      view={view}
      workspaceSwitcher={
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setView({ ...view, workspace: other, workspaces: [...view.workspaces, other] })
          }
        >
          Switch to Atelier Sud
        </Button>
      }
    />
  );
}

/** Switching workspace closes the drawer, though the page does not change: the drawer belongs to the workspace it was opened over, as it does to the page. */
export const MenuClosesOnWorkspaceChange: Story = {
  globals: onScreen("tablet"),
  render: (args) => <SwitchingShell {...args} />,
  play: async ({ canvasElement }) => {
    const { page, dialog } = await openDrawer(canvasElement, "Menu");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Switch to Atelier Sud" }),
    );

    await waitFor(() =>
      expect(page.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};

/** Under 480 px: the header keeps the logo and the bell, and a tab bar at the bottom holds the first four pages and More. */
export const Phone: Story = {
  globals: onScreen("mobile2"),
};

/** More opens the drawer from the bottom: the other pages, Settings and Help, the workspace and the account. */
export const PhoneMoreOpen: Story = {
  globals: onScreen("mobile2"),
  args: { view: FIVE_PAGES },
  play: async ({ canvasElement }) => {
    const { dialog } = await openDrawer(canvasElement, "More");

    await expect(dialog).toBeVisible();
    // The fifth page has no tab: the drawer is where it is.
    await expect(
      within(dialog).getByRole("link", { name: "People" }),
    ).toBeVisible();
  },
};

/** Escape closes the drawer of the phone, and the focus is back on More, the tab that opened it. */
export const MoreClosesWithEscape: Story = {
  globals: onScreen("mobile2"),
  args: { view: FIVE_PAGES },
  play: async ({ canvasElement }) => {
    const { page, opener } = await openDrawer(canvasElement, "More");

    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(page.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(opener).toHaveFocus());
  },
};

/**
 * Closing the drawer of the phone leaves the page where it was. The focus goes
 * back to More, which is stuck to the bottom of the screen, and a plain `focus()`
 * on it makes the browser scroll the document to where the tab sits in the flow,
 * which is the end of the page: the page moved by hundreds of pixels each time.
 * The page is taller than the screen, so that a jump has somewhere to go, and what
 * is measured is the closing: the position of the page while the sheet is open,
 * and after it has closed. (A click made by a script, which focuses the tab, may
 * move the page when it opens the sheet; a finger or a mouse does not.)
 */
export const MoreClosesWithoutScrolling: Story = {
  globals: onScreen("mobile2"),
  args: {
    view: FIVE_PAGES,
    children: (
      <div className="space-y-6">
        <FakePage />
        <div aria-hidden="true" className="h-[120vh]" />
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const win = canvasElement.ownerDocument.defaultView;
    win?.scrollTo(0, 150);
    await waitFor(() => expect(win?.scrollY).toBe(150));

    const { page, opener } = await openDrawer(canvasElement, "More");
    // The page stays still behind the open sheet: this is where the person left it
    const whileOpen = win?.scrollY;
    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(page.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(opener).toHaveFocus());
    await expect(win?.scrollY).toBe(whileOpen);
  },
};

/**
 * A toast on a phone sits above the tab bar and never over it: the bar is stuck
 * to the bottom, and an error stays until it is closed, so a toast under it would
 * hide the tabs for as long as it stays. Measured on screen, once the toast has
 * come in.
 */
export const ToastsStayAboveTheTabBar: Story = {
  globals: onScreen("mobile2"),
  render: (args) => (
    <>
      <AppShell {...args} />
      <Toaster position="bottom-right" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const bar = page.getByRole("navigation", { name: "Main navigation" });

    toast.error("Could not save your changes");
    const message = await page.findByText("Could not save your changes");
    const item = message.closest("[data-sonner-toast]");
    await expect(item).not.toBeNull();

    // The toast slides in: it is measured once it has stopped
    await waitFor(() => {
      const gap = bar.getBoundingClientRect().top - (item as Element).getBoundingClientRect().bottom;
      expect(gap).toBeGreaterThanOrEqual(0);
    });
    await expect(item).toBeVisible();
  },
};

/** Someone who belongs to no workspace yet: the shell is drawn with its navigation, and the slot offers to create one. */
export const WithoutWorkspace: Story = {
  globals: onScreen("desktop"),
  args: {
    view: { ...VIEW, workspace: null, workspaces: [] },
    workspaceSwitcher: <FakeCreateWorkspace />,
    accountMenu: <FakeAccountMenu role="camille@example.com" />,
  },
};

/** A platform admin has a section of its own, under a title, between the pages and Settings. Nobody else is given it. */
export const PlatformAdmin: Story = {
  globals: onScreen("desktop"),
  args: {
    view: {
      ...VIEW,
      user: { ...VIEW.user, isPlatformAdmin: true },
      nav: { ...VIEW.nav, admin: ADMIN_LINKS },
    },
    accountMenu: <FakeAccountMenu role="Platform admin" />,
  },
  parameters: at("/admin/users"),
};

/**
 * French is longer, and names are not ours to choose: a workspace of 60
 * characters, a person and a product with long names, and labels that do not fit
 * a fifth of a phone (390 px). Everything is cut with an ellipsis and nothing
 * leaves its row.
 */
export const LongNames: Story = {
  globals: { ...onScreen("phone"), locale: "fr" },
  args: {
    view: {
      ...VIEW,
      productName: "Jardins partagés de quartier",
      nav: {
        main: [
          link("home", "/dashboard", "Accueil", HouseIcon),
          link("projects", "/projects", "Projets en cours et archivés", FolderIcon),
          link("assistant", "/ai", "Assistant de rédaction", BotIcon),
          link("reports", "/reports", "Rapports mensuels détaillés", ChartColumnIcon),
          link("people", "/people", "Membres et invitations", UsersIcon),
        ],
        secondary: [
          link(
            "settings",
            "/settings/account",
            "Réglages du compte et de l’espace",
            SlidersHorizontalIcon,
            "/settings",
          ),
          link("help", "mailto:support@example.com", "Centre d’aide et contact", CircleHelpIcon),
        ],
        admin: [],
      },
    },
    workspaceSwitcher: (
      <FakeWorkspaceSwitcher
        name="Association des amis du jardin partagé de la rue Saint-Michel"
        plan="Forfait Équipe"
      />
    ),
    accountMenu: (
      <FakeAccountMenu
        name="Jean-Baptiste de la Fontaine-Beaumarchais"
        role="Propriétaire"
      />
    ),
    sidebarActions: <FakeFeedbackRow label="Envoyer un commentaire" />,
    children: <FakePage title="Bienvenue, Jean-Baptiste" />,
  },
};
