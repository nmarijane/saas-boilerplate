import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { NotificationRow } from "./notification-row";

// A row of the list, at the width of the panel it is drawn in (320 px less the
// padding of its list). Nothing is called when it is opened: the stories read
// what it hands over.

const MINUTE = 60_000;

/** An ISO date, as the API gives it, this long ago: "2 hours ago" stays "2 hours ago" whenever the story is opened. */
function ago(milliseconds: number): string {
  return new Date(Date.now() - milliseconds).toISOString();
}

const UNREAD = {
  id: "n1",
  title: "Payment failed",
  body: "We could not charge the card ending in 4242. Update your payment method to keep your plan.",
  read: false,
  type: "warning",
  link: "/settings/billing",
  createdAt: ago(35 * MINUTE),
};

const meta = {
  title: "Features/NotificationRow",
  component: NotificationRow,
  args: { notification: UNREAD, onOpen: fn() },
  argTypes: { notification: { control: "object" } },
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[17.5rem] rounded-lg border bg-popover p-1">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NotificationRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Unread: a dot in the brand color before the title, and the word "Unread" for assistive technology. Opening it hands over its id and its link. */
export const Unread: Story = {
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement).getByRole("button", { name: /Unread Payment failed/ });

    await expect(canvasElement.querySelector('[data-slot="status-dot"]')).toBeInTheDocument();
    await userEvent.click(row);
    await expect(args.onOpen).toHaveBeenCalledOnce();
    await expect(args.onOpen).toHaveBeenCalledWith("n1", "/settings/billing");
  },
};

/** Read: no dot, and the title stays where it is: the room of the dot is kept. */
export const Read: Story = {
  args: {
    notification: { ...UNREAD, read: true, createdAt: ago(26 * 60 * MINUTE) },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="status-dot"]')).not.toBeInTheDocument();
    await expect(within(canvasElement).queryByText("Unread")).not.toBeInTheDocument();
  },
};

/** A notification with no link: opening it hands over `null`, and the panel only marks it read. */
export const WithoutLink: Story = {
  args: {
    notification: {
      ...UNREAD,
      id: "n4",
      title: "Welcome aboard",
      body: "Your workspace is ready.",
      link: null,
      createdAt: ago(9 * 24 * 60 * MINUTE),
    },
  },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await expect(args.onOpen).toHaveBeenCalledOnce();
    await expect(args.onOpen).toHaveBeenCalledWith("n4", null);
  },
};

/** A title and a body that are not ours to choose: a long body stops at two lines, and a word with no break is broken where it would overflow. */
export const LongText: Story = {
  args: {
    notification: {
      ...UNREAD,
      title: "Invoice INV-2026-11-000042-FROM-THE-ACCOUNTING-DEPARTMENT-OF-A-VERY-LONG-COMPANY-NAME is overdue",
      body: "The invoice was sent on the first of the month and is still unpaid, which puts the plan of the workspace at risk. Pay it from the billing page, or write to us if something looks wrong with it, and we will sort it out together.",
      createdAt: ago(2 * 24 * 60 * MINUTE),
    },
  },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole("button");
    const body = within(row).getByText(/^The invoice was sent/);
    const { lineHeight } = getComputedStyle(body);

    // Two lines of 18 px, cut: what is hidden is still there to be read by a screen reader.
    await expect(Math.round(body.clientHeight)).toBeLessThanOrEqual(2 * Number.parseFloat(lineHeight));
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    // The long word does not push the row out of the list.
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
  },
};

/** The time reads in the language of the page. */
export const French: Story = {
  args: {
    notification: {
      ...UNREAD,
      title: "Paiement refusé",
      body: "Nous n'avons pas pu débiter la carte se terminant par 4242.",
    },
  },
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Non lue")).toBeInTheDocument();
    await expect(within(canvasElement).getByText("il y a 35 minutes")).toBeInTheDocument();
  },
};

/** Rows one under the other, read and unread: the titles line up, and the pointer tints the row it is on. */
export const InAList: Story = {
  render: (args) => (
    <ul role="list" className="flex flex-col gap-0.5">
      <li>
        <NotificationRow {...args} />
      </li>
      <li>
        <NotificationRow
          {...args}
          notification={{
            ...UNREAD,
            id: "n2",
            title: "Camille joined Studio Nord",
            body: "Camille Laurent accepted your invitation.",
            link: "/settings/team",
            createdAt: ago(3 * 60 * MINUTE),
          }}
        />
      </li>
      <li>
        <NotificationRow
          {...args}
          notification={{
            ...UNREAD,
            id: "n3",
            title: "Your export is ready",
            body: "The file is available for 24 hours.",
            read: true,
            link: null,
            createdAt: ago(26 * 60 * MINUTE),
          }}
        />
      </li>
    </ul>
  ),
};
