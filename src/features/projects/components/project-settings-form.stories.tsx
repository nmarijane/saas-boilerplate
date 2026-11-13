import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ProjectSettingsForm, ProjectSettingsFormView } from "./project-settings-form";

// The form of the settings of a project. The server action it calls is a stub
// (Storybook replaces every server action) that always works: a save that
// fails is shown by the stories of the view, the way the feedback form shows
// its own.

const PROJECT = {
  id: "project_atlas",
  name: "Atlas website",
  description: "Rebuild the marketing site on the new design system.",
  status: "draft",
} as const;

const meta = {
  title: "Features/ProjectSettingsForm",
  component: ProjectSettingsForm,
  tags: ["autodocs"],
  args: { orgId: "org_1", project: PROJECT },
  parameters: {
    // Saving reads the page again, through the router of the app: Storybook has
    // none, and mounts a stand-in for the stories that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/projects/project_atlas/settings" } },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProjectSettingsForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The name, the description and the status of the project, as they are now.
 * Change one and save: "Saved" appears next to the button, and goes away as
 * soon as a field changes again.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByLabelText(/Name/);

    await expect(name).toHaveValue("Atlas website");
    await expect(canvas.getByRole("button", { name: "Draft" })).toHaveAttribute("aria-pressed", "true");
    // The caption of the status is a label like the others, and only the legend of the group is read out
    const caption = canvasElement.querySelector('span[data-slot="label"]');
    await expect(caption).toHaveTextContent("Status");
    await expect(caption).toHaveAttribute("aria-hidden", "true");
    await expect(canvas.getByRole("group", { name: "Status" })).toBeVisible();
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();

    await userEvent.type(name, " 2");
    await userEvent.click(canvas.getByRole("button", { name: "Active" }));
    await expect(canvas.getByRole("button", { name: "Active" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Saved"));

    await userEvent.type(name, "!");
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
};

/** An active project, with no description: the field is empty and says how long it may be. */
export const Active: Story = {
  args: { project: { ...PROJECT, status: "active", description: null } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("button", { name: "Active" })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByLabelText("Description")).toHaveValue("");
    await expect(canvas.getByText("Optional. 280 characters at most.")).toBeVisible();
  },
};

/** Save waits for a name: it is disabled while the field is empty, or holds only spaces. */
export const NeedsAName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByLabelText(/Name/);
    const save = canvas.getByRole("button", { name: "Save" });

    await userEvent.clear(name);
    await expect(save).toBeDisabled();
    await userEvent.type(name, "   ");
    await expect(save).toBeDisabled();
    await userEvent.type(name, "Atlas");
    await expect(save).toBeEnabled();
  },
};

/** The same form in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText(/Nom/)).toHaveValue("Atlas website");
    await expect(canvas.getByRole("button", { name: "Brouillon" })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
  },
};

// The view of the form, for what the stub cannot show: a save that is running
// and one that failed.
type ViewProps = React.ComponentProps<typeof ProjectSettingsFormView>;

function View(props: Partial<ViewProps>) {
  return (
    <div className="max-w-xl">
      <ProjectSettingsFormView
        name="Atlas website"
        description="Rebuild the marketing site on the new design system."
        status="draft"
        pending={false}
        saved={false}
        failed={false}
        onNameChange={fn()}
        onDescriptionChange={fn()}
        onStatusChange={fn()}
        onSubmit={fn()}
        {...props}
      />
    </div>
  );
}

/** The last save worked: a status next to the button says so. */
export const Saved: Story = {
  render: () => <View saved />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Saved");
  },
};

/** The save is running: the fields are read-only, the status is fixed, and Save shows that it works and keeps the focus. */
export const Saving: Story = {
  render: () => <View pending />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole("button", { name: /Save/ });

    await expect(canvas.getByLabelText(/Name/)).toHaveAttribute("readonly");
    await expect(canvas.getByRole("group", { name: "Status" })).toBeDisabled();
    await expect(save).toHaveAttribute("aria-disabled", "true");
    await expect(save).not.toBeDisabled();
  },
};

/** The server refused, or did not answer: what was typed is kept, and an alert says so above the button. */
export const Failed: Story = {
  render: () => <View failed name="Atlas website 2" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toHaveTextContent("We couldn't save your changes. Please try again.");
    await expect(canvas.getByLabelText(/Name/)).toHaveValue("Atlas website 2");
    await expect(canvas.getByRole("button", { name: "Save" })).toBeEnabled();
  },
};

export const FailedInFrench: Story = {
  globals: { locale: "fr" },
  render: () => <View failed />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("Impossible d'enregistrer vos modifications. Veuillez réessayer.");
  },
};
