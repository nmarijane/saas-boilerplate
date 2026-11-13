import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ProfileForm, ProfileFormView } from "./profile-form";

// The form of the profile, in the first card of the account page. The server
// action it calls is a stub (Storybook replaces every server action) that always
// works: a save that fails is shown by the stories of the view, the way the form
// of a project shows its own.

const meta = {
  title: "Features/ProfileForm",
  component: ProfileForm,
  tags: ["autodocs"],
  args: {
    defaultValues: { name: "Camille Laurent", email: "camille@example.com", image: null },
  },
  parameters: {
    // Saving reads the page again, through the router of the app: Storybook has
    // none, and mounts a stand-in for the stories that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/settings/account" } },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProfileForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The name, the email (read-only, and it says why) and the link of the avatar,
 * as they are now. Change the name and save: "Saved" appears next to the button,
 * and goes away as soon as a field changes again.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByLabelText(/Name/);
    const email = canvas.getByLabelText("Email");

    await expect(name).toHaveValue("Camille Laurent");
    await expect(email).toHaveValue("camille@example.com");
    await expect(email).toHaveAttribute("readonly");
    await expect(email).toHaveAccessibleDescription("You can't change your email here.");
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();

    await userEvent.type(name, " Jr");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Saved"));

    await userEvent.type(name, "!");
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
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
    await userEvent.type(name, "Camille");
    await expect(save).toBeEnabled();
  },
};

/** A link that is no address on the web is said under the field, and nothing is sent. Fixing it is another try. */
export const RefusesABadLink: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const avatar = canvas.getByLabelText("Avatar");

    await userEvent.type(avatar, "example.com/me.png");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));

    await expect(canvas.getByRole("alert")).toHaveTextContent("Enter a full link, such as https://example.com/me.png.");
    await expect(avatar).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();

    await userEvent.clear(avatar);
    await userEvent.type(avatar, "https://example.com/me.png");
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Saved"));
  },
};

/** The same form in French. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText(/Nom/)).toHaveValue("Camille Laurent");
    await expect(canvas.getByLabelText("E-mail")).toHaveAccessibleDescription("Vous ne pouvez pas modifier votre e-mail ici.");
    await expect(canvas.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
  },
};

// The view of the form, for what the stub cannot show: a save that is running
// and one that failed.
type ViewProps = React.ComponentProps<typeof ProfileFormView>;

function View(props: Partial<ViewProps>) {
  return (
    <div className="max-w-xl">
      <ProfileFormView
        name="Camille Laurent"
        email="camille@example.com"
        image=""
        pending={false}
        saved={false}
        failed={false}
        imageInvalid={false}
        onNameChange={fn()}
        onImageChange={fn()}
        onSubmit={fn()}
        {...props}
      />
    </div>
  );
}

/** The save is running: the fields are read-only, and Save shows that it works and keeps the focus. */
export const Saving: Story = {
  render: () => <View pending />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole("button", { name: /Save/ });

    await expect(canvas.getByLabelText(/Name/)).toHaveAttribute("readonly");
    await expect(canvas.getByLabelText("Avatar")).toHaveAttribute("readonly");
    await expect(save).toHaveAttribute("aria-disabled", "true");
    await expect(save).not.toBeDisabled();
  },
};

/** The server refused, or did not answer: what was typed is kept, and an alert says so above the button. */
export const Failed: Story = {
  render: () => <View failed name="Camille" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toHaveTextContent("We couldn't save your changes. Please try again.");
    await expect(canvas.getByLabelText(/Name/)).toHaveValue("Camille");
    await expect(canvas.getByRole("button", { name: "Save" })).toBeEnabled();
  },
};
