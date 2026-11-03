import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Field } from "./field";
import { PasswordInput } from "./password-input";

const meta = {
  title: "UI/PasswordInput",
  component: PasswordInput,
  tags: ["autodocs"],
  argTypes: {
    disabled: {
      control: "boolean",
    },
    "aria-invalid": {
      control: "boolean",
    },
  },
  args: {
    "aria-label": "Password",
    defaultValue: "correct horse battery",
  },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Tab reaches the field, then the eye button; Space or Enter shows the password. The button is named in the language of the page (Language toolbar). */
export const Default: Story = {};

/** Through a Field: the label, the hint and the error are tied to the field, which turns danger. */
export const WithError: Story = {
  render: () => (
    <Field
      label="Password"
      htmlFor="password-error"
      hint="At least 8 characters."
      error="That password is too short."
      required
    >
      <PasswordInput defaultValue="short" />
    </Field>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
};

/** A long French label, hint and error in a narrow column: they wrap, nothing is cut. */
export const LongLabel: Story = {
  render: () => (
    <Field
      label="Nouveau mot de passe pour accéder à votre espace de travail"
      htmlFor="password-long"
      hint="Au moins huit caractères, dont un chiffre et une lettre majuscule, sans votre adresse e-mail."
      error="Ce mot de passe est trop court : ajoutez au moins trois caractères pour continuer."
    >
      <PasswordInput defaultValue="court" />
    </Field>
  ),
  decorators: [
    (Story) => (
      <div className="w-64 max-w-full">
        <Story />
      </div>
    ),
  ],
};
