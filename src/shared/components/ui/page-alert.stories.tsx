import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import { PageAlert } from "./page-alert";
import { TextLink } from "./text-link";

const tones = ["info", "success", "warning", "danger"] as const;

const meta = {
  title: "UI/PageAlert",
  component: PageAlert,
  tags: ["autodocs"],
  argTypes: {
    tone: {
      control: "inline-radio",
      options: tones,
    },
  },
  args: {
    tone: "info",
    title: "A new version is available",
    children: "Reload the page to get the latest improvements.",
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Announced politely: it waits for the screen reader to finish. */
export const Info: Story = {};

/** Announced politely, like info. */
export const Success: Story = {
  args: {
    tone: "success",
    title: "Your changes are saved",
    children: "Everyone on the team sees them now.",
  },
};

/** A warning interrupts assistive technology (`role="alert"`). */
export const Warning: Story = {
  args: {
    tone: "warning",
    title: "You have used 82 % of your AI credits",
    children: "Upgrade before the end of the month to keep using AI chat.",
  },
};

/** A danger interrupts assistive technology too. */
export const Danger: Story = {
  args: {
    tone: "danger",
    title: "Payment failed",
    children: "Your card was declined. Update it to keep your plan.",
  },
};

/** Each tone has an icon of its own: color is never the only sign. */
export const AllTones: Story = {
  render: () => (
    <div className="grid gap-3">
      <PageAlert tone="info" title="A new version is available">
        Reload the page to get the latest improvements.
      </PageAlert>
      <PageAlert tone="success" title="Your changes are saved">
        Everyone on the team sees them now.
      </PageAlert>
      <PageAlert tone="warning" title="You have used 82 % of your AI credits">
        Upgrade before the end of the month to keep using AI chat.
      </PageAlert>
      <PageAlert tone="danger" title="Payment failed">
        Your card was declined. Update it to keep your plan.
      </PageAlert>
    </div>
  ),
};

/** The action sits at the end, and drops under the message when the alert is narrow. */
export const WithAction: Story = {
  args: {
    tone: "warning",
    title: "You have used 82 % of your AI credits",
    children: "Upgrade before the end of the month to keep using AI chat.",
    action: (
      <Button size="sm" variant="outline">
        See plans
      </Button>
    ),
  },
};

export const WithoutTitle: Story = {
  args: {
    tone: "info",
    title: undefined,
    children: "Changes can take a minute to reach every region.",
  },
};

/** Links keep their own style inside the message. */
export const WithLink: Story = {
  args: {
    tone: "danger",
    title: "We could not reach your webhook endpoint",
    children: (
      <>
        Check its URL and your firewall, then{" "}
        <TextLink href="#" intent="danger">
          read the delivery log
        </TextLink>
        .
      </>
    ),
  },
};

/** The layout follows the width of the alert, not the screen: in a narrow column the action takes its own line. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-72">
        <Story />
      </div>
    ),
  ],
  args: {
    tone: "warning",
    title: "You have used 82 % of your AI credits",
    children: "Upgrade before the end of the month to keep using AI chat.",
    action: (
      <Button size="sm" variant="outline">
        See plans
      </Button>
    ),
  },
};

/** French runs longer: nothing is cut. */
export const LongText: Story = {
  args: {
    tone: "danger",
    title: "Le paiement de votre abonnement a échoué à deux reprises",
    children:
      "Votre banque a refusé la carte enregistrée. Mettez-la à jour avant le 5 du mois pour conserver votre offre et l'accès à tous vos projets.",
    action: (
      <Button size="sm" variant="outline">
        Mettre à jour la carte
      </Button>
    ),
  },
};
