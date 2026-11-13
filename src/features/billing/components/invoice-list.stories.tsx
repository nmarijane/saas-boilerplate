import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { InvoiceList } from "./invoice-list";

const meta = {
  title: "Features/Billing/InvoiceList",
  component: InvoiceList,
  tags: ["autodocs"],
  args: {
    invoices: [
      { id: "in_3", number: "A1B2-0003", createdAt: new Date("2026-11-14T00:00:00Z"), amount: 2900, currency: "usd", status: "open", url: "https://invoice.example/3" },
      { id: "in_2", number: "A1B2-0002", createdAt: new Date("2026-10-14T00:00:00Z"), amount: 2900, currency: "usd", status: "paid", url: "https://invoice.example/2" },
      { id: "in_1", number: "A1B2-0001", createdAt: new Date("2026-09-14T00:00:00Z"), amount: 2900, currency: "usd", status: "void", url: null },
    ],
  },
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="max-w-3xl"><Story /></div>],
} satisfies Meta<typeof InvoiceList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    await expect(canvas.getAllByRole("link", { name: /View/ })).toHaveLength(2);
  },
};

export const Empty: Story = { args: { invoices: [] } };

/** The provider could not be read: one line, and the rest of the page is untouched. */
export const Failed: Story = { args: { invoices: null } };
