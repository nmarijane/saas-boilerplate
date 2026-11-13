import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { RouteError } from "./route-error";

const meta = {
  title: "Data/RouteError",
  component: RouteError,
  tags: ["autodocs"],
  args: { error: new Error("The database did not answer"), retry: fn() },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RouteError>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * What the `error.tsx` of a route draws in place of its page: the error state,
 * with its title as the one h1, and a retry. The words come from the locales:
 * switch the language in the toolbar. What the error said is never drawn.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toBeVisible();
    await expect(canvas.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeVisible();
    await expect(canvas.queryByText(/database/)).toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(args.retry).toHaveBeenCalledTimes(1);
  },
};

/**
 * A page that is replaced often takes the focus with it, and leaves it on the
 * body: it goes to the title, where assistive technology reads the alert and a
 * keyboard starts from.
 */
export const TakesTheFocus: Story = {
  play: async ({ canvasElement }) => {
    const title = within(canvasElement).getByRole("heading", { level: 1 });

    await waitFor(() => expect(title).toHaveFocus());
  },
};

/**
 * A focus that is on something stays there: the link of the shell that was just
 * followed, here a button drawn before the state, which has the focus when the
 * state appears.
 */
export const KeepsTheFocus: Story = {
  decorators: [
    (Story) => (
      <>
        <button type="button" autoFocus className="mb-4 min-h-11 rounded-md border border-hairline px-4">
          Somewhere else
        </button>
        <Story />
      </>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Somewhere else" });

    // The state looks at the focus in an effect, which runs after the paint: give
    // it the time to run, or this passes whatever the state does with the focus
    await new Promise((resolve) => setTimeout(resolve, 150));
    await expect(button).toHaveFocus();
    await expect(canvas.getByRole("heading", { level: 1 })).not.toHaveFocus();
  },
};

/** The title is a place the focus goes to by script, and no tab stop: the keyboard goes from the page straight to the retry. */
export const TitleIsNoTabStop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole("heading", { level: 1 });

    await waitFor(() => expect(title).toHaveFocus());
    await expect(title).toHaveAttribute("tabindex", "-1");
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Try again" })).toHaveFocus();
  },
};

export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 1, name: "Une erreur est survenue" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Réessayer" })).toBeVisible();
  },
};
