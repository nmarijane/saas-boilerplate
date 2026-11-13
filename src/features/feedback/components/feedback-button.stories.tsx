import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ShellView } from "@/shared/shell/view";
import { HouseIcon, SlidersHorizontalIcon } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { MINIMAL_VIEWPORTS } from "storybook/viewport";
import { AppShell } from "@/shared/components/shell/app-shell";
import { FeedbackButton } from "./feedback-button";
import { FeedbackNavButton } from "./feedback-nav-button";

// The feedback button as the shell draws it, a row under Settings and Help, and
// as a button of its own. Nothing here reaches a server: the action that sends
// the feedback is a stub (Storybook replaces every server action), and no story
// presses Send. The dialog is drawn in a portal under the body.

const meta = {
  title: "Features/FeedbackButton",
  component: FeedbackButton,
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true, navigation: { pathname: "/dashboard" } },
  },
} satisfies Meta<typeof FeedbackButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The button on the background it is drawn on in the shell, in a column as wide as the sidebar's content. */
const inTheSidebar: NonNullable<Story["decorators"]> = [
  (Story) => (
    <div className="w-56 bg-sidebar p-3">
      <Story />
    </div>
  ),
];

/** The row of the sidebar: 44 px high like the rows of the navigation, with its icon and its label. */
export const Nav: Story = {
  decorators: inTheSidebar,
  args: { variant: "nav" },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole("button", { name: "Send feedback" });

    await expect(row).toHaveAttribute("aria-haspopup", "dialog");
    await expect(row).toHaveAttribute("aria-expanded", "false");
    await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};

/** A button of its own, for a bar: the icon, and the name for assistive technology. */
export const Icon: Story = {
  decorators: inTheSidebar,
  args: { variant: "icon" },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Send feedback" });

    await expect(button).toBeVisible();
    await expect(button.textContent).toBe("");
  },
};

/** The label of the row, in French. */
export const French: Story = {
  decorators: inTheSidebar,
  args: { variant: "nav" },
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Envoyer un feedback" })).toBeVisible();
  },
};

/**
 * Pressing the row opens the dialog, and closing it with Escape gives the focus
 * back to the row, which Radix would not do (the dialog has no trigger of its own).
 */
export const OpensTheDialog: Story = {
  decorators: inTheSidebar,
  args: { variant: "nav" },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const row = within(canvasElement).getByRole("button", { name: "Send feedback" });

    await userEvent.click(row);
    const dialog = await page.findByRole("dialog", { name: "Feedback" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByLabelText("Message")).toBeVisible();
    await expect(within(dialog).getByRole("button", { name: "Send feedback" })).toBeDisabled();
    await expect(row).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(row).toHaveFocus();
    await expect(row).toHaveAttribute("aria-expanded", "false");
  },
};

const view: ShellView = {
  productName: "Example",
  user: { id: "user_1", name: "Camille Laurent", email: "camille@example.com", image: null, isPlatformAdmin: false },
  workspace: null,
  workspaces: [],
  nav: {
    main: [{ id: "home", href: "/dashboard", label: "Home", icon: <HouseIcon aria-hidden="true" /> }],
    secondary: [
      { id: "settings", href: "/settings/account", label: "Settings", icon: <SlidersHorizontalIcon aria-hidden="true" />, match: "/settings" },
    ],
    admin: [],
  },
  account: [],
  settings: [],
  quotas: [],
};

/**
 * In the shell, from 480 to 1024 px, the row is in the drawer: the dialog opens
 * over the drawer, and Escape closes the dialog only, with the focus back on the
 * row of the drawer, which stays open.
 */
export const InTheDrawer: Story = {
  parameters: { layout: "fullscreen", viewport: { options: MINIMAL_VIEWPORTS } },
  // The Menu button that opens the drawer is drawn from 480 to 1024 px: the story is made for a tablet
  globals: { viewport: { value: "tablet", isRotated: false } },
  decorators: [
    () => (
      <AppShell
        view={view}
        workspaceSwitcher={<div />}
        accountMenu={<div />}
        sidebarActions={<FeedbackNavButton />}
      >
        <p>The page</p>
      </AppShell>
    ),
  ],
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);

    await userEvent.click(page.getByRole("button", { name: "Menu" }));
    const drawer = await page.findByRole("dialog", { name: "Menu" });
    const row = within(drawer).getByRole("button", { name: "Send feedback" });

    await userEvent.click(row);
    const dialog = await page.findByRole("dialog", { name: "Feedback" });
    await waitFor(() => expect(dialog).toBeVisible());

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(page.queryByRole("dialog", { name: "Feedback" })).not.toBeInTheDocument());
    await expect(drawer).toBeVisible();
    await expect(row).toHaveFocus();
  },
};
