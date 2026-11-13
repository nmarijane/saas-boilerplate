import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ShellLink, ShellQuota, ShellWorkspace } from "@/shared/shell/view";
import { CreditCardIcon, DatabaseIcon, UserIcon, ZapIcon } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AccountMenu } from "./account-menu";

// The account menu, at the foot of the column of the sidebar it lives in. The
// stories open it with a `play` function (the menu is drawn in a portal under
// the body). Nothing here reaches a server: theme and language only act where
// there is a provider and a router, and the auth client is only called when
// someone signs out or switches workspace, which no story does.

const NORD: ShellWorkspace = { id: "org_1", name: "Studio Nord", role: "owner", plan: "Pro" };
const SUD: ShellWorkspace = { id: "org_2", name: "Atelier Sud", role: "admin", plan: "Team" };

/** Eight workspaces: more rows than a short screen has room for. */
const EIGHT: ShellWorkspace[] = [
  NORD,
  SUD,
  { id: "org_3", name: "Acme", role: "member", plan: null },
  { id: "org_4", name: "Bureau des légendes", role: "member", plan: "Pro" },
  { id: "org_5", name: "Café Mélodie", role: "admin", plan: "Free" },
  { id: "org_6", name: "Delta Labs", role: "owner", plan: "Team" },
  { id: "org_7", name: "Éditions du Phare", role: "member", plan: "Pro" },
  { id: "org_8", name: "Fabrique Ouest", role: "member", plan: null },
];

const LONG_NAME = "Association des amis du jardin partagé de la rue Victor-Hugo";

const USER = {
  id: "user_1",
  name: "Camille Laurent",
  email: "camille@example.com",
  image: null,
  isPlatformAdmin: false,
};

function link(id: string, href: string, label: string, icon: ShellLink["icon"]): ShellLink {
  return { id, href, label, icon };
}

const LINKS = [
  link("account", "/settings/account", "Account", <UserIcon aria-hidden="true" />),
  link("billing", "/settings/billing", "Billing", <CreditCardIcon aria-hidden="true" />),
];

const LIENS = [
  link("account", "/settings/account", "Compte", <UserIcon aria-hidden="true" />),
  link("billing", "/settings/billing", "Abonnement", <CreditCardIcon aria-hidden="true" />),
];

function quota(
  id: string,
  label: string,
  status: ShellQuota["status"],
  used: number,
  limit: number,
  extra: Partial<ShellQuota> = {},
): ShellQuota {
  return {
    id,
    label,
    used,
    limit,
    status,
    icon: <ZapIcon aria-hidden="true" />,
    tone: 1,
    upgradeHref: "/settings/billing",
    ...extra,
  };
}

/** Three quotas: only the two that run low or are reached are detailed in the menu, the one at its limit first. */
const QUOTAS = [
  quota("members", "Members", "ok", 3, 10),
  quota("storage", "Storage", "warning", 4200, 5000, {
    unit: "megabyte",
    icon: <DatabaseIcon aria-hidden="true" />,
  }),
  quota("credits", "AI credits", "limit", 100, 100),
];

const QUOTAS_FR = [
  quota("members", "Membres", "ok", 3, 10),
  quota("storage", "Stockage", "warning", 4200, 5000, {
    unit: "megabyte",
    icon: <DatabaseIcon aria-hidden="true" />,
  }),
  quota("credits", "Crédits IA", "limit", 100, 100),
];

/** A photo that is no network call: a plain tint, as an uploaded picture would be. */
const PHOTO =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='orange'/><circle cx='16' cy='13' r='6' fill='white'/><rect x='6' y='22' width='20' height='10' rx='5' fill='white'/></svg>";

/** Opens the menu, and hands back the page and the menu. */
async function openMenu(canvasElement: HTMLElement, name: RegExp = /Camille Laurent/) {
  const page = within(canvasElement.ownerDocument.body);

  await userEvent.click(within(canvasElement).getByRole("button", { name }));
  const menu = await page.findByRole("menu");
  // The menu fades in: it is in the page before it can be seen.
  await waitFor(() => expect(menu).toBeVisible());

  return { page, menu };
}

/** The names of the rows of the menu, in order. */
function rowsOf(menu: HTMLElement): string[] {
  return within(menu)
    .getAllByRole("menuitem")
    .map((row) => row.textContent?.trim() ?? "");
}

const meta = {
  title: "Features/AccountMenu",
  component: AccountMenu,
  args: {
    user: USER,
    workspace: NORD,
    workspaces: [NORD, SUD],
    links: LINKS,
    quotas: [],
  },
  argTypes: { quotas: { control: "object" }, links: { control: "object" } },
  parameters: {
    layout: "centered",
    // The menu switches language and signs out through the router of the app:
    // Storybook has none, and mounts a stand-in for the stories that say they
    // use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/dashboard" } },
    // While a modal menu is open, Radix hides the page (the trigger included)
    // from assistive technology and traps the focus in the menu: the trigger
    // cannot be reached, which axe cannot tell.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  // The trigger sits at the foot of a column, as it does in the sidebar, and the menu opens upward.
  decorators: [
    (Story) => (
      <div className="flex min-h-[34rem] w-62 flex-col justify-end bg-sidebar p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The person: a tile of initials (or their photo), their name over their role in the workspace, and the chevrons. */
export const Default: Story = {};

/** The photo of the person, in a circle of 32 px. The tile of initials is behind it until it loads. */
export const WithPhoto: Story = {
  args: { user: { ...USER, image: PHOTO } },
};

/** Without a workspace (a platform admin who has none) there is no role to tell: the e-mail is under the name. */
export const WithoutWorkspace: Story = {
  args: { workspace: null, workspaces: [] },
};

/** A name and an e-mail that are too long for a row of 224 px are cut with an ellipsis. */
export const LongNames: Story = {
  args: {
    user: {
      ...USER,
      name: "Jean-Baptiste de la Fontaine-Beaumarchais-Montmorency",
      email: "jean-baptiste.de-la-fontaine-beaumarchais@exemple-association.org",
    },
  },
  play: async ({ canvasElement }) => {
    const { menu } = await openMenu(canvasElement, /Jean-Baptiste/);

    await expect(menu).toBeVisible();
  },
};

/**
 * The menu, in order: who they are, the links of the features, theme and
 * language, the switch of workspace (for someone who has more than one), and
 * sign out.
 */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const { menu } = await openMenu(canvasElement);

    await expect(menu).toBeVisible();
    await expect(within(menu).getByText("camille@example.com")).toBeVisible();
    await expect(within(menu).getByText("Studio Nord")).toBeVisible();
    await expect(within(menu).getByText("Pro plan")).toBeVisible();
    // The menu is described by its summary, which is what a screen reader reads when it opens.
    const summary = menu.ownerDocument.getElementById(
      menu.getAttribute("aria-describedby") ?? "",
    );
    await expect(summary).toHaveTextContent("camille@example.com");
    await expect(summary).toHaveTextContent("Pro plan");
    await expect(rowsOf(menu)).toEqual([
      "Account",
      "Billing",
      "Theme",
      "Language",
      "Switch workspace",
      "Sign out",
    ]);
    // Nothing runs low: no bar in the menu.
    await expect(within(menu).queryByRole("progressbar")).not.toBeInTheDocument();
  },
};

/**
 * What runs low is detailed in the menu: a bar, the figures with their unit, and
 * the state in words. A quota that is fine is left to the home. The bars are for
 * the eye (a menu owns items, and a bar is none): assistive technology reads the
 * figures and the state beside them.
 */
export const QuotasInAlert: Story = {
  args: { quotas: QUOTAS },
  play: async ({ canvasElement }) => {
    const { menu } = await openMenu(canvasElement);
    await expect(within(menu).queryByRole("progressbar")).not.toBeInTheDocument();
    const bars = within(menu).getAllByRole("progressbar", { hidden: true });

    await expect(bars.map((bar) => bar.getAttribute("aria-label"))).toEqual([
      "AI credits",
      "Storage",
    ]);
    await expect(within(menu).getByText("Limit reached")).toBeVisible();
    await expect(within(menu).getByText("Running low")).toBeVisible();
    await expect(within(menu).getByText(/4,200 MB of 5,000 MB/)).toBeVisible();
    await expect(within(menu).queryByText("Members")).not.toBeInTheDocument();
  },
};

/** One workspace: nothing to switch to, so the row is not there. */
export const OneWorkspace: Story = {
  args: { workspaces: [NORD] },
  play: async ({ canvasElement }) => {
    const { menu } = await openMenu(canvasElement);

    await expect(rowsOf(menu)).not.toContain("Switch workspace");
  },
};

/** The same menu in French: longer words, « Plan Pro », « Bientôt épuisé ». */
export const French: Story = {
  globals: { locale: "fr" },
  args: { links: LIENS, quotas: QUOTAS_FR },
  play: async ({ canvasElement }) => {
    const { menu } = await openMenu(canvasElement);

    await expect(rowsOf(menu)).toEqual([
      "Compte",
      "Abonnement",
      "Thème",
      "Langue",
      "Changer d'espace",
      "Se déconnecter",
    ]);
    await expect(within(menu).getByText("Bientôt épuisé")).toBeVisible();
    await expect(within(menu).getByText("Limite atteinte")).toBeVisible();
    await expect(within(menu).getByText("Studio Nord")).toBeVisible();
    await expect(within(menu).getByText("Plan Pro")).toBeVisible();
  },
};

/** Theme: light, dark or the one of the device, which is the one ticked until a choice is made. next-themes keeps the choice, and these stories have no provider for it: it acts in the app. */
export const ThemeChoices: Story = {
  play: async ({ canvasElement }) => {
    const { page, menu } = await openMenu(canvasElement);

    await userEvent.click(within(menu).getByRole("menuitem", { name: "Theme" }));
    const choices = await page.findAllByRole("menuitemradio");

    await expect(choices.map((choice) => choice.textContent)).toEqual([
      "Light",
      "Dark",
      "System",
    ]);
    await expect(choices[2]).toHaveAttribute("aria-checked", "true");
  },
};

/** Language: each in its own words, the current one ticked. */
export const LanguageChoices: Story = {
  play: async ({ canvasElement }) => {
    const { page, menu } = await openMenu(canvasElement);

    await userEvent.click(within(menu).getByRole("menuitem", { name: "Language" }));
    const choices = await page.findAllByRole("menuitemradio");

    await expect(choices.map((choice) => choice.textContent)).toEqual([
      "English",
      "Français",
    ]);
    await expect(choices[0]).toHaveAttribute("aria-checked", "true");
    await expect(choices[1]).toHaveAttribute("aria-checked", "false");
    await expect(choices[1]).toHaveAttribute("lang", "fr");
  },
};

/** Switch workspace: the workspaces of the person, the one they are in ticked. */
export const WorkspaceChoices: Story = {
  play: async ({ canvasElement }) => {
    const { page, menu } = await openMenu(canvasElement);

    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Switch workspace" }),
    );
    const sub = await page.findByRole("menuitem", { name: /Atelier Sud/ });

    await waitFor(() => expect(sub).toBeVisible());
    await expect(
      page.getByRole("menuitem", { name: /Studio Nord.*Current workspace/ }),
    ).toBeVisible();
  },
};

/**
 * The workspace has a name of 60 characters. The summary cuts the name, and
 * never the plan, which is what its line is for.
 */
export const LongWorkspaceName: Story = {
  args: {
    workspace: { ...NORD, name: LONG_NAME },
    workspaces: [{ ...NORD, name: LONG_NAME }, SUD],
  },
  play: async ({ canvasElement }) => {
    const { menu } = await openMenu(canvasElement);
    const name = within(menu).getByText(LONG_NAME);
    const plan = within(menu).getByText("Pro plan");
    const inside = menu.getBoundingClientRect();
    const planBox = plan.getBoundingClientRect();

    // The plan is whole and inside the menu; the name is what is cut.
    await expect(planBox.width).toBeGreaterThan(0);
    await expect(planBox.right).toBeLessThanOrEqual(inside.right);
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
  },
};

/**
 * Eight workspaces under « Switch workspace », on a screen that may be short:
 * the submenu keeps to the height the screen leaves it and scrolls inside, as
 * the menu does, so that its last rows are not under the fold.
 */
export const ManyWorkspaces: Story = {
  args: { workspaces: EIGHT },
  play: async ({ canvasElement }) => {
    // On a short screen the foot of the page, where the trigger is, is out of sight.
    within(canvasElement)
      .getByRole("button", { name: /Camille Laurent/ })
      .scrollIntoView({ block: "end" });
    const { page, menu } = await openMenu(canvasElement);

    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Switch workspace" }),
    );
    await waitFor(() => expect(page.getAllByRole("menu")).toHaveLength(2));
    const sub = page.getAllByRole("menu")[1] as HTMLElement;
    await waitFor(() => expect(sub).toBeVisible());
    const rows = within(sub).getAllByRole("menuitem");
    const style = sub.ownerDocument.defaultView?.getComputedStyle(sub);

    await expect(rows).toHaveLength(8);
    // It scrolls, and it is bounded by what the screen leaves it.
    await expect(style?.overflowY).toBe("auto");
    await expect(style?.maxHeight).not.toBe("none");
    // It stays on the screen, and its last row is reached by scrolling to the end.
    const screen = sub.ownerDocument.defaultView?.innerHeight ?? 0;
    sub.scrollTop = sub.scrollHeight;
    const box = sub.getBoundingClientRect();
    const last = rows.at(-1)?.getBoundingClientRect();
    await expect(box.top).toBeGreaterThanOrEqual(0);
    await expect(box.bottom).toBeLessThanOrEqual(screen);
    await expect(last?.bottom ?? Infinity).toBeLessThanOrEqual(box.bottom + 1);
    await expect(last?.top ?? -Infinity).toBeGreaterThanOrEqual(box.top - 1);
  },
};
