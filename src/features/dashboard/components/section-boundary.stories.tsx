import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { HomeTask } from "@/shared/shell/view";
import { FolderPlusIcon } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { HomeTasks } from "./home-tasks";
import { SectionBoundary } from "./section-boundary";

// The sections of the home are the features', drawn by the page each in its own
// boundary. Here one of them reads a flag: it throws while the flag is up, as a
// section does when its query fails, and draws its card once the flag is down,
// as the same query does when it is asked again.
const database = { down: true };

function RecentProjects() {
  if (database.down) {
    throw new Error("The projects did not load");
  }

  return (
    <section>
      <h2 className="text-section text-ink">Recent projects</h2>
      <p className="text-body text-ink-muted">Atlas, Borealis and Cirrus.</p>
    </section>
  );
}

function TeamNotes() {
  return (
    <section>
      <h2 className="text-section text-ink">Team notes</h2>
      <p className="text-body text-ink-muted">Nothing to read today.</p>
    </section>
  );
}

const STEP: HomeTask = {
  id: "first-project",
  label: "Create your first project",
  icon: <FolderPlusIcon aria-hidden="true" />,
  tone: 1,
  done: false,
  action: { href: "/projects", label: "Create a project" },
};

// The blocks of the home as the page lays them out: the sections, then the first steps.
function Home() {
  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <SectionBoundary>
          <RecentProjects />
        </SectionBoundary>
        <SectionBoundary>
          <TeamNotes />
        </SectionBoundary>
      </div>
      <HomeTasks tasks={[STEP]} done={0} />
    </div>
  );
}

const meta = {
  title: "Features/SectionBoundary",
  tags: ["autodocs"],
  parameters: {
    // The boundary asks the router of the app to fetch the page again when it
    // retries: Storybook has none, and mounts a stand-in for the stories that
    // say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/dashboard" } },
  },
  beforeEach: () => {
    database.down = true;
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * One section throws. It shows the error state in its own place, at level two
 * (the h1 is the header's), and the other section and the first steps are still
 * there: the error does not go up to the boundary of the route, which would
 * replace the whole page. React logs the error it caught, as it does for any
 * boundary.
 */
export const OneSectionFails: Story = {
  render: () => <Home />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole("alert")).toHaveLength(1);
    await expect(canvas.getByRole("heading", { level: 2, name: "Something went wrong" })).toBeVisible();
    await expect(canvas.queryByText(/Atlas/)).toBeNull();

    await expect(canvas.getByRole("heading", { level: 2, name: "Team notes" })).toBeVisible();
    await expect(canvas.getByRole("heading", { level: 2, name: "First steps" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Create a project" })).toBeVisible();
  },
};

/** Retry asks for the section again: once what failed answers, it takes the place of the error, and the rest did not move. */
export const RetryRecovers: Story = {
  render: () => <Home />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toBeVisible();
    database.down = false;
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(canvas.getByRole("heading", { level: 2, name: "Recent projects" })).toBeVisible());
    await expect(canvas.queryByRole("alert")).toBeNull();
    await expect(canvas.getByRole("heading", { level: 2, name: "Team notes" })).toBeVisible();
  },
};

/** While no section throws, the boundary draws nothing of its own. */
export const NothingFails: Story = {
  render: () => <Home />,
  beforeEach: () => {
    database.down = false;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByRole("alert")).toBeNull();
    await expect(canvas.getByRole("heading", { level: 2, name: "Recent projects" })).toBeVisible();
    await expect(canvas.getByRole("heading", { level: 2, name: "Team notes" })).toBeVisible();
  },
};

export const French: Story = {
  globals: { locale: "fr" },
  render: () => <Home />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading", { level: 2, name: "Une erreur est survenue" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Réessayer" })).toBeVisible();
  },
};
