import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import { BellIcon, FolderIcon } from "lucide-react";
import { fn } from "storybook/test";

import { EmptyState } from "./empty-state";

const meta = {
  title: "Data/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  argTypes: {
    icon: { control: false },
    illustration: { control: false },
    headingLevel: { control: "inline-radio", options: [1, 2, 3] },
  },
  args: {
    icon: FolderIcon,
    title: "No projects yet",
    description: "Create your first project and it will show up here.",
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>;

export default meta;
// The props are a union (an icon or an illustration is required): the stories
// are typed on the component, as `typeof meta` cannot tell which member the
// args of the meta stand for.
type Story = StoryObj<typeof EmptyState>;

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

/** A tinted tile, a title and one sentence. With nothing to do, there is no button. */
export const Default: Story = {};

/** The one button runs a handler: a client component holds it. */
export const WithAction: Story = {
  args: {
    action: { label: "New project", onClick: fn() },
  },
};

/** The one button is a link, on the locale-aware Link of the app: a server page can render it. */
export const WithLink: Story = {
  decorators: [stayHere],
  args: {
    action: { label: "New project", href: "/projects/new" },
  },
};

// Art a project supplies. It is drawn with the theme tokens, so that it follows
// the dark theme and a new brand like everything else. It carries no label: the
// state hides it from assistive technology, as it is decoration.
function ProjectIllustration() {
  return (
    <svg viewBox="0 0 160 112" fill="none" className="h-28 w-40">
      <rect x="40" y="12" width="96" height="72" rx="12" className="fill-brand-tint" />
      <rect
        x="24"
        y="28"
        width="96"
        height="72"
        rx="12"
        strokeWidth="2"
        className="fill-surface stroke-hairline"
      />
      <rect x="40" y="46" width="40" height="8" rx="4" className="fill-track" />
      <rect x="40" y="62" width="64" height="6" rx="3" className="fill-hairline" />
      <rect x="40" y="76" width="52" height="6" rx="3" className="fill-hairline" />
      <circle cx="120" cy="88" r="16" className="fill-brand" />
      <path
        d="M120 80v16M112 88h16"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-brand-on"
      />
    </svg>
  );
}

/** An illustration stands where the tile would, and wins when both are given. It is decoration by contract, so the state hides it from assistive technology. */
export const WithIllustration: Story = {
  decorators: [stayHere],
  args: {
    illustration: <ProjectIllustration />,
    action: { label: "New project", href: "/projects/new" },
  },
};

/** The two empty areas of the app today: an icon, a title and a sentence. */
export const NoNotifications: Story = {
  args: {
    icon: BellIcon,
    title: "No notifications",
    description: "Your notification history will appear here.",
  },
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
    title: "Aucun projet nommé RefonteDuSiteVitrineStudioNord2026Version12",
    description:
      "Créez-le, ou rattachez l’espace 3f9a1c7e5b2d4a60918e7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6 depuis un autre compte.",
    action: { label: "Créer un projet", onClick: fn() },
  },
};
