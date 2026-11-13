import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Toaster } from "@/shared/components/ui/sonner";
import { WaitlistAdminTable } from "./waitlist-admin-table";

// The table of the waiting list on the admin page, in the card that titles it.
// The server action it calls is a stub (Storybook replaces every server action)
// that always works: an invitation that is refused is the business of the tests
// of the flow, which have a server that answers no.

const TITLE_ID = "entries-title";

function entry(
  id: string,
  email: string,
  status: string,
  referralCount: number,
  referralCode: string,
  day: number,
) {
  return {
    id,
    email,
    status,
    referralCount,
    referralCode,
    referredBy: null,
    createdAt: new Date(Date.UTC(2026, 9, day, 9)),
  };
}

const ENTRIES = [
  entry("w1", "ada@example.com", "waiting", 3, "ADA4K9", 20),
  entry("w2", "grace@example.com", "waiting", 0, "GRC7P2", 18),
  entry("w3", "linus@example.com", "invited", 1, "LNS2Q8", 15),
  entry("w4", "margaret@example.com", "joined", 5, "MRG9T3", 11),
];

const meta = {
  title: "Features/WaitlistAdminTable",
  component: WaitlistAdminTable,
  tags: ["autodocs"],
  args: { entries: ENTRIES, labelledBy: TITLE_ID },
  parameters: {
    // An invitation reads the page again, through the router of the app:
    // Storybook has none, and mounts a stand-in for the stories that say they
    // use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/admin/waitlist" } },
  },
  // The table sits in a card, edge to edge, as the page puts it.
  decorators: [
    (Story) => (
      <div className="max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle as="h2" id={TITLE_ID}>
              Entries
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Story />
          </CardContent>
        </Card>
        <Toaster />
      </div>
    ),
  ],
} satisfies Meta<typeof WaitlistAdminTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One row each: the address, the status in a badge, the referrals and the code, the day, and an Invite button for those who wait. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole("row")).toHaveLength(ENTRIES.length + 1);
    await expect(canvas.getAllByRole("button")).toHaveLength(2);
    await expect(canvas.getByRole("button", { name: "Invite ada@example.com" })).toBeVisible();
    await expect(canvas.getByText("Invited")).toBeVisible();
    // The column that says when they joined, and the badge of the one who did
    await expect(canvas.getAllByText("Joined")).toHaveLength(2);
  },
};

/**
 * Inviting someone shows them as invited, and the button of their row goes: the
 * focus is not lost to the page. It stays on the box that holds the table, as it
 * does on the other lists, so that the next Tab starts from the table.
 */
export const InvitesSomeone: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Invite ada@example.com" }));

    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: "Invite ada@example.com" })).not.toBeInTheDocument(),
    );
    await expect(canvas.getAllByText("Invited")).toHaveLength(2);
    // The other row that waits keeps its button, and the focus is on the table's box
    await expect(canvas.getByRole("button", { name: "Invite grace@example.com" })).toBeVisible();
    await waitFor(() => expect(canvasElement.querySelector('[tabindex="-1"]')).toHaveFocus());
  },
};

/** The last person who waited is invited: the table holds no button at all, and the focus still has a place to rest. */
export const InvitesTheLastOne: Story = {
  args: { entries: [ENTRIES[0] ?? entry("w1", "ada@example.com", "waiting", 3, "ADA4K9", 20), ENTRIES[3] ?? entry("w4", "margaret@example.com", "joined", 5, "MRG9T3", 11)] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Invite ada@example.com" }));

    await waitFor(() => expect(canvas.queryAllByRole("button")).toHaveLength(0));
    await waitFor(() => expect(canvasElement.querySelector('[tabindex="-1"]')).toHaveFocus());
  },
};

/** Nobody waits yet: one row says so. */
export const Empty: Story = {
  args: { entries: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("No waitlist entries yet.")).toBeVisible();
  },
};

/** The same table in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("button", { name: "Inviter ada@example.com" })).toBeVisible();
    await expect(canvas.getByText("Invité")).toBeVisible();
  },
};
