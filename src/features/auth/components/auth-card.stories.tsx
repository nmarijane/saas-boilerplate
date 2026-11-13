import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MailIcon } from "lucide-react";
import { expect, within } from "storybook/test";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { Input } from "@/shared/components/ui/input";
import { TextLink } from "@/shared/components/ui/text-link";
import { AuthCard } from "./auth-card";

// The card of a sign-in page, as the layout of the pages draws it: one column of
// at most 448 px, centered. The stories hold a small form in it, whatever the
// page puts there (the forms have their own stories).

const meta = {
  title: "Features/AuthCard",
  component: AuthCard,
  tags: ["autodocs"],
  args: {
    title: "Sign In",
    description: "Welcome back. Sign in to continue.",
    footer: (
      <>
        Don&apos;t have an account?{" "}
        <TextLink href="/sign-up" className="tap-target">
          Sign Up
        </TextLink>
      </>
    ),
    children: (
      <form className="grid gap-5">
        <Field label="Email" htmlFor="auth-card-email">
          <Input type="email" className="min-h-11" />
        </Field>
        <Button type="submit" className="w-full">
          Sign In
        </Button>
      </form>
    ),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AuthCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One `h1`, in the card: the title, then its muted sentence, the form, and a footer of text and links. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole("heading")).toHaveLength(1);
    await expect(canvas.getByRole("heading", { level: 1, name: "Sign In" })).toBeVisible();
    await expect(canvas.getByText("Welcome back. Sign in to continue.")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Sign Up" })).toBeVisible();
  },
};

/**
 * A card that only says something: a picture centered above the title, the title,
 * its sentence and a way on, with no body between the sentence and the footer.
 * The picture is decoration; the title is still the one heading.
 */
export const WithIcon: Story = {
  args: {
    title: "Verify Email",
    description: "We sent you an email with a link. Open it to confirm your address.",
    icon: <IconTile icon={MailIcon} tone="brand" size="lg" />,
    children: undefined,
    footer: (
      <TextLink href="/sign-in" className="tap-target">
        Back to sign in
      </TextLink>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tile = canvasElement.querySelector('[data-slot="icon-tile"]');
    const title = canvas.getByRole("heading", { level: 1, name: "Verify Email" });

    await expect(canvas.getAllByRole("heading")).toHaveLength(1);
    await expect(tile).not.toBeNull();
    // Above the title, in the card
    await expect((tile?.compareDocumentPosition(title) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expect(canvasElement.querySelector('[data-slot="card-content"]')).toBeNull();
    await expect(canvas.getByRole("link", { name: "Back to sign in" })).toBeVisible();
  },
};

/** No footer: a card that has nowhere else to lead. */
export const WithoutFooter: Story = {
  args: { footer: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("link")).not.toBeInTheDocument();
  },
};

/** No description: the title and the form. */
export const WithoutDescription: Story = {
  args: { description: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("heading", { level: 1 })).toBeVisible();
  },
};

/** A long title wraps and stays centered: the card never grows past its column. */
export const LongTitle: Story = {
  args: {
    title: "Choose a new password for your account, then sign in again",
    description: "A long sentence in the description wraps the same way, under the title, as far as the card is wide.",
  },
};

/** The same card in French. */
export const French: Story = {
  globals: { locale: "fr" },
  args: {
    title: "Se connecter",
    description: "Content de vous revoir. Connectez-vous pour continuer.",
    footer: (
      <>
        Pas encore de compte ?{" "}
        <TextLink href="/sign-up" className="tap-target">
          S&apos;inscrire
        </TextLink>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("heading", { level: 1, name: "Se connecter" })).toBeVisible();
  },
};
