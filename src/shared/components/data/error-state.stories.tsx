import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { ErrorState } from "./error-state";

const meta = {
  title: "Data/ErrorState",
  component: ErrorState,
  tags: ["autodocs"],
  argTypes: {
    headingLevel: { control: "inline-radio", options: [1, 2, 3] },
  },
  args: { onRetry: fn() },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The words come from the locales: switch the language in the toolbar. It is an alert, so a screen reader says it as it appears. */
export const Default: Story = {};

/** With nothing to retry, there is no button, and the state is still an alert. */
export const WithoutRetry: Story = {
  args: { onRetry: undefined },
};

/** A screen that knows what failed says so, and names the retry for what it does. */
export const CustomCopy: Story = {
  args: {
    title: "Projects did not load",
    description: "The server did not answer. Your projects are safe.",
    retryLabel: "Reload projects",
  },
};

/** A route's `error.tsx` replaces the page, so nothing above the state holds a heading: it passes `headingLevel={1}`. The look does not change. */
export const RouteLevel: Story = {
  args: { headingLevel: 1 },
};

/** French runs longer, and a name or an identifier does not break: a token wider than the card wraps inside it, title and sentence alike, and the button keeps its size. Look at it at 320 px. */
export const LongText: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-72">
        <Story />
      </div>
    ),
  ],
  args: {
    title: "Impossible de charger RefonteDuSiteVitrineStudioNord2026Version12",
    description:
      "Le serveur n’a pas répondu pour l’espace 3f9a1c7e5b2d4a60918e7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6. Vos projets sont en sécurité.",
    retryLabel: "Recharger les projets",
  },
};
