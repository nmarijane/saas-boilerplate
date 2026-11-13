import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ActivityIcon, UsersIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  args: {
    defaultValue: "overview",
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The active tab has a line in the brand color and ink text. Arrow keys, Home and End move between the tabs. */
export const Default: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList aria-label="Project sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-ink-soft">The summary of the project.</p>
      </TabsContent>
      <TabsContent value="activity">
        <p className="text-ink-soft">What changed, and who changed it.</p>
      </TabsContent>
      <TabsContent value="members">
        <p className="text-ink-soft">Who can see and edit the project.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const WithIcons: Story = {
  args: { defaultValue: "activity" },
  render: (args) => (
    <Tabs {...args}>
      <TabsList aria-label="Project sections">
        <TabsTrigger value="activity">
          <ActivityIcon />
          Activity
        </TabsTrigger>
        <TabsTrigger value="members">
          <UsersIcon />
          Members
        </TabsTrigger>
      </TabsList>
      <TabsContent value="activity">
        <p className="text-ink-soft">What changed, and who changed it.</p>
      </TabsContent>
      <TabsContent value="members">
        <p className="text-ink-soft">Who can see and edit the project.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const WithDisabledTab: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList aria-label="Project sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="billing" disabled>
          Billing
        </TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-ink-soft">The summary of the project.</p>
      </TabsContent>
      <TabsContent value="members">
        <p className="text-ink-soft">Who can see and edit the project.</p>
      </TabsContent>
    </Tabs>
  ),
};

/**
 * French labels run longer. The tabs never shrink: in a container too narrow
 * for them, as here and on a phone, the strip scrolls sideways, and the line
 * stays under the active tab. The page opens on the second tab, which the strip
 * brings into view.
 */
export const LongLabels: Story = {
  args: { defaultValue: "facturation" },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Tabs {...args}>
      <TabsList aria-label="Sections du projet">
        <TabsTrigger value="apercu">Aperçu général</TabsTrigger>
        <TabsTrigger value="facturation">Facturation et paiements</TabsTrigger>
        <TabsTrigger value="membres">Membres de l'équipe</TabsTrigger>
      </TabsList>
      <TabsContent value="apercu">
        <p className="text-ink-soft">Le résumé du projet.</p>
      </TabsContent>
      <TabsContent value="facturation">
        <p className="text-ink-soft">Les factures et le moyen de paiement.</p>
      </TabsContent>
      <TabsContent value="membres">
        <p className="text-ink-soft">Qui peut voir et modifier le projet.</p>
      </TabsContent>
    </Tabs>
  ),
};

const sections = [
  ["overview", "Overview"],
  ["activity", "Activity"],
  ["members", "Members"],
  ["billing", "Billing"],
  ["developers", "Developers"],
  ["notifications", "Notifications"],
] as const;

/**
 * More tabs than a phone holds, and the page opens on one of the last: the
 * strip scrolls it into view when it loads (without an animation) and each time
 * the selection changes, with a glide that reduced motion turns off. Click the
 * first tab, or move with the arrow keys, and the strip follows.
 */
export const ActiveTabOutOfSight: Story = {
  args: { defaultValue: "notifications" },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Tabs {...args}>
      <TabsList aria-label="Account sections">
        {sections.map(([value, label]) => (
          <TabsTrigger key={value} value={value}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {sections.map(([value, label]) => (
        <TabsContent key={value} value={value}>
          <p className="text-ink-soft">{label}</p>
        </TabsContent>
      ))}
    </Tabs>
  ),
};
