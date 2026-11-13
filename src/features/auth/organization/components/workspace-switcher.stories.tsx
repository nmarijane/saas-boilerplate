import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ShellView, ShellWorkspace } from "@/shared/shell/view";
import { FolderIcon, HouseIcon, SlidersHorizontalIcon } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { MINIMAL_VIEWPORTS } from "storybook/viewport";
import { AccountMenu } from "@/features/auth/components/account-menu";
import { AppShell } from "@/shared/components/shell/app-shell";
import { WorkspaceList, WorkspaceSwitcher } from "./workspace-switcher";

// The workspace switcher, in the column of the sidebar it lives in. Nothing here
// reaches a server: the action that creates a workspace is a stub (Storybook
// replaces every server action), and the auth client is only called when a
// workspace is chosen, which no story does. Opening the list is what the `play`
// functions do; the list is drawn in a portal under the body.

const NORD: ShellWorkspace = { id: "org_1", name: "Studio Nord", role: "owner", plan: "Pro" };
const SUD: ShellWorkspace = { id: "org_2", name: "Atelier Sud", role: "admin", plan: "Team" };
const ACME: ShellWorkspace = { id: "org_3", name: "Acme", role: "member", plan: null };

const THREE = [NORD, SUD, ACME];

/** Eight workspaces: past six the list has a search field, and it scrolls. Accents are there to be searched without. */
const EIGHT: ShellWorkspace[] = [
  NORD,
  SUD,
  ACME,
  { id: "org_4", name: "Bureau des légendes", role: "member", plan: "Pro" },
  { id: "org_5", name: "Café Mélodie", role: "admin", plan: "Free" },
  { id: "org_6", name: "Delta Labs", role: "owner", plan: "Team" },
  { id: "org_7", name: "Éditions du Phare", role: "member", plan: "Pro" },
  { id: "org_8", name: "Fabrique Ouest", role: "member", plan: null },
];

/** The list opens under the trigger: the page, the trigger and the list, as the shell draws them. */
async function openList(canvasElement: HTMLElement, name: RegExp = /Studio Nord/) {
  const page = within(canvasElement.ownerDocument.body);
  const trigger = within(canvasElement).getByRole("button", { name });

  await userEvent.click(trigger);
  const list = await page.findByRole("listbox", { name: "Switch workspace" });
  // The list fades in: it is in the page before it can be seen.
  await waitFor(() => expect(list).toBeVisible());

  return { page, trigger, list };
}

const meta = {
  title: "Features/WorkspaceSwitcher",
  component: WorkspaceSwitcher,
  args: { workspaces: THREE, activeId: "org_1" },
  argTypes: { workspaces: { control: "object" } },
  // The switcher goes home through the router of the app: Storybook has none,
  // and mounts a stand-in for the stories that say they use the App Router.
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true, navigation: { pathname: "/dashboard" } },
  },
  // A story that is a whole screen (the shell) has a column of its own.
  decorators: [
    (Story, { parameters }) =>
      parameters.layout === "fullscreen" ? (
        <Story />
      ) : (
        <div className="w-62 bg-sidebar p-3">
          <Story />
        </div>
      ),
  ],
} satisfies Meta<typeof WorkspaceSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The workspace the person works in: its tile, its name over its plan, and the
 * chevrons that say it can be changed. The row is a target of 44 px at least,
 * and as wide as its column: the size is measured here, in a browser.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: /Studio Nord/ });
    const { height, width } = trigger.getBoundingClientRect();

    await expect(height).toBeGreaterThanOrEqual(44);

    // The column the row sits in, without its padding
    const column = trigger.parentElement;
    const style = column ? getComputedStyle(column) : null;
    const room = column && style ? column.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight) : 0;
    await expect(Math.round(width)).toBe(Math.round(room));
  },
};

/** One workspace: the trigger is the same, and the list holds it and the row that creates another. */
export const SingleWorkspace: Story = {
  args: { workspaces: [NORD], activeId: "org_1" },
};

/** Without a plan to tell, the role of the person is told under the name. */
export const WithoutPlan: Story = {
  args: { activeId: "org_3" },
};

/** A name of 60 characters, which is not ours to choose: it is cut with an ellipsis and stays in its row. */
export const LongName: Story = {
  args: {
    workspaces: [
      {
        id: "org_1",
        name: "Association des amis du jardin partagé de la rue Victor-Hugo",
        role: "owner",
        plan: "Pro",
      },
    ],
  },
};

/** Someone who belongs to no workspace yet: the trigger offers to create one, and opens the dialog. */
export const NoWorkspace: Story = {
  args: { workspaces: [], activeId: null },
};

/** French is longer: the plan reads « Plan Pro », and the words of the list are in French. */
export const French: Story = {
  globals: { locale: "fr" },
};

/**
 * The list of three: no search field, as the whole list is in sight. It is the
 * list that has the focus (its highlighted row is what a screen reader reads).
 * The person is in the third workspace, and it is the one highlighted when the
 * list opens, not the first, which cmdk would highlight on its own: that is
 * what `defaultValue` is for. The arrow keys move it from there.
 */
export const Open: Story = {
  args: { activeId: "org_3" },
  play: async ({ canvasElement }) => {
    const { list } = await openList(canvasElement, /Acme/);
    const rows = within(list).getAllByRole("option");

    await expect(list).toBeVisible();
    await expect(list).toHaveFocus();
    await expect(rows).toHaveLength(4);
    await expect(within(list).queryByRole("combobox")).not.toBeInTheDocument();
    await expect(rows[2]).toHaveAttribute("data-current");
    await expect(rows[2]).toHaveAttribute("data-selected", "true");
    await expect(rows[0]).toHaveAttribute("data-selected", "false");

    await userEvent.keyboard("{ArrowUp}");
    await expect(rows[1]).toHaveAttribute("data-selected", "true");
    await expect(rows[2]).toHaveAttribute("data-selected", "false");
  },
};

/** Escape closes the list, and the focus is back on the trigger. */
export const ClosesWithEscape: Story = {
  play: async ({ canvasElement }) => {
    const { page, trigger } = await openList(canvasElement);

    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(page.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/**
 * Eight workspaces: a search field, which has the focus. It finds a workspace by
 * its name, in any case and without its accents ("edit" finds « Éditions du
 * Phare »), never by its id, and the row that creates a workspace stays whatever
 * is typed. A search that finds nothing says so.
 */
export const ManyWorkspaces: Story = {
  args: { workspaces: EIGHT },
  play: async ({ canvasElement }) => {
    const { list } = await openList(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const search = page.getByRole("combobox");

    await expect(search).toHaveFocus();
    await expect(within(list).getAllByRole("option")).toHaveLength(9);

    await userEvent.type(search, "edit");
    await expect(within(list).getAllByRole("option")).toHaveLength(2);
    await expect(
      within(list).getByRole("option", { name: /Éditions du Phare/ }),
    ).toBeVisible();
    await expect(
      within(list).getByRole("option", { name: /Create workspace/ }),
    ).toBeVisible();

    await userEvent.clear(search);
    await userEvent.type(search, "org_");
    await expect(page.getByText("No workspace found")).toBeVisible();
    await expect(
      within(list).getByRole("option", { name: /Create workspace/ }),
    ).toBeVisible();
  },
};

/** « Create workspace » closes the list and opens the dialog, with the name field in focus. Escape closes the dialog, and the focus is back on the trigger. */
export const CreatesFromTheList: Story = {
  play: async ({ canvasElement }) => {
    const { page, trigger, list } = await openList(canvasElement);

    await userEvent.click(
      within(list).getByRole("option", { name: /Create workspace/ }),
    );

    const dialog = await page.findByRole("dialog", { name: "Create workspace" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByLabelText(/Workspace name/)).toHaveFocus();
    await waitFor(() =>
      expect(page.queryByRole("listbox")).not.toBeInTheDocument(),
    );

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(page.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/** Without a workspace the trigger opens the dialog at once: there is no list to choose from. Escape closes it, and the focus is back on the trigger. */
export const CreatesWithoutWorkspace: Story = {
  args: { workspaces: [], activeId: null },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const trigger = within(canvasElement).getByRole("button", {
      name: "Create workspace",
    });

    await userEvent.click(trigger);

    const dialog = await page.findByRole("dialog", { name: "Create workspace" });
    await waitFor(() => expect(dialog).toBeVisible());

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(page.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/**
 * The list while a switch runs: the workspace being switched to shows a spinner
 * where the tick is and keeps its look, the others and the row that creates one
 * wait. Nothing here is clicked: this is the list on its own, with the state
 * the real switch (a call to the auth server) puts it in.
 */
export const Switching: Story = {
  // The list at its own width, outside the column of the sidebar.
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="w-72 overflow-hidden rounded-lg border bg-popover shadow-pop">
      <WorkspaceList
        workspaces={THREE}
        activeId="org_1"
        pendingId="org_2"
        onSelect={() => {}}
        onCreate={() => {}}
      />
    </div>
  ),
};

// The two slots in the shell they are made for, at the width where the sidebar
// is a drawer: the list and the menu open over a modal sheet, which is the
// layering that has to work (a popover and a menu in a dialog).
const LINKS = {
  home: {
    id: "home",
    href: "/dashboard",
    label: "Home",
    icon: <HouseIcon aria-hidden="true" />,
  },
  projects: {
    id: "projects",
    href: "/projects",
    label: "Projects",
    icon: <FolderIcon aria-hidden="true" />,
  },
  settings: {
    id: "settings",
    href: "/settings/account",
    label: "Settings",
    icon: <SlidersHorizontalIcon aria-hidden="true" />,
    match: "/settings",
  },
} as const;

const SHELL_VIEW: ShellView = {
  productName: "Orbit",
  user: {
    id: "user_1",
    name: "Camille Laurent",
    email: "camille@example.com",
    image: null,
    isPlatformAdmin: false,
  },
  workspace: NORD,
  workspaces: THREE,
  nav: {
    main: [LINKS.home, LINKS.projects],
    secondary: [LINKS.settings],
    admin: [],
  },
  account: [LINKS.settings],
  settings: [],
  quotas: [],
};

/**
 * Both slots in the drawer of a tablet. The list opens over the sheet and takes
 * the focus; Escape closes the list and leaves the drawer; the account menu
 * opens over it as well.
 */
export const InTheDrawer: Story = {
  parameters: {
    layout: "fullscreen",
    viewport: { options: MINIMAL_VIEWPORTS },
    nextjs: { appDirectory: true, navigation: { pathname: "/projects" } },
    // While a modal menu is open, Radix hides the page from assistive technology.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  globals: { viewport: { value: "tablet", isRotated: false } },
  render: () => (
    <div className="-m-6">
      <AppShell
        view={SHELL_VIEW}
        workspaceSwitcher={
          <WorkspaceSwitcher workspaces={THREE} activeId="org_1" />
        }
        accountMenu={
          <AccountMenu
            user={SHELL_VIEW.user}
            workspace={NORD}
            workspaces={THREE}
            links={SHELL_VIEW.account}
            quotas={[]}
          />
        }
      >
        <h1 className="text-page">Projects</h1>
      </AppShell>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(page.getByRole("button", { name: "Menu" }));
    const drawer = await page.findByRole("dialog", { name: "Menu" });

    await userEvent.click(
      within(drawer).getByRole("button", { name: /Studio Nord/ }),
    );
    const list = await page.findByRole("listbox", { name: "Switch workspace" });
    await waitFor(() => expect(list).toBeVisible());
    await expect(list).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(page.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();

    await userEvent.click(
      within(drawer).getByRole("button", { name: /Camille Laurent/ }),
    );
    const menu = await page.findByRole("menu");
    await waitFor(() => expect(menu).toBeVisible());
  },
};
