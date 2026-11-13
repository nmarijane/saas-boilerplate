import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { MINIMAL_VIEWPORTS } from "storybook/viewport";
import { PublicHeader } from "./public-header";

// A story must not leave the page when a link is followed.
const stayHere: Decorator = (Story) => (
  <div
    onClickCapture={(event) => {
      if ((event.target as HTMLElement).closest("a")) {
        event.preventDefault();
      }
    }}
  >
    <Story />
  </div>
);

const meta = {
  title: "Layout/PublicHeader",
  component: PublicHeader,
  tags: ["autodocs"],
  decorators: [stayHere],
  args: { trialHref: "/sign-up?plan=pro&interval=monthly" },
  parameters: {
    layout: "fullscreen",
    viewport: { options: MINIMAL_VIEWPORTS },
    // While the menu is open, Radix hides the page from assistive technology
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
} satisfies Meta<typeof PublicHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The logo, the navigation, "Sign in" and the free trial of the recommended plan. */
export const Desktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("link", { name: "Free trial" })).toHaveAttribute("href", "/en/sign-up?plan=pro&interval=monthly");
    await expect(canvas.getByRole("link", { name: "Pricing" })).toBeVisible();
  },
};

/** A product with no trial says "Sign up" in its place. */
export const WithoutTrial: Story = {
  args: { trialHref: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("link", { name: "Sign Up" })).toBeVisible();
  },
};

/** Under 768 px the navigation and the two buttons move into a menu. */
export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Menu" }));

    const menu = within(await within(document.body).findByRole("dialog"));
    await expect(menu.getByRole("link", { name: "Free trial" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Sign In" })).toBeVisible();
  },
};
