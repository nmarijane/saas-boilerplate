import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { EmbeddedCheckout } from "./embedded-checkout";

// Stripe.js is not loaded in a story (it is the provider's script, from its own domain): with a key
// that is no key, the form cannot load, and says so with the way to try again, which is what is drawn here.
const meta = {
  title: "Features/Billing/EmbeddedCheckout",
  component: EmbeddedCheckout,
  tags: ["autodocs"],
  args: { clientSecret: "fake-client-secret", publishableKey: "", sessionId: "cs_1" },
  parameters: { layout: "centered", nextjs: { appDirectory: true, navigation: { pathname: "/settings/billing" } }, },
} satisfies Meta<typeof EmbeddedCheckout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CannotLoad: Story = {
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("button", { name: "Try again" })).toBeVisible();
  },
};
