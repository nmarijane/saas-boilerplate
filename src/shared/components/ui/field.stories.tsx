import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";

import { Field } from "./field";
import { Input } from "./input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Textarea } from "./textarea";

const meta = {
  title: "UI/Field",
  component: Field,
  tags: ["autodocs"],
  argTypes: {
    hint: {
      control: "text",
    },
    error: {
      control: "text",
    },
    required: {
      control: "boolean",
    },
  },
  args: {
    label: "Email",
    htmlFor: "email",
    children: <Input type="email" placeholder="you@example.com" />,
  },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { hint: "We only use it to send you the receipt." },
};

/** The error is announced when it appears, and marks the control invalid. */
export const WithError: Story = {
  args: {
    hint: "We only use it to send you the receipt.",
    error: "Enter an address like name@example.com.",
    children: <Input type="email" defaultValue="ada@" />,
  },
};

/** The asterisk is only for the eye: the control carries `aria-required`. */
export const Required: Story = {
  args: { required: true },
};

export const Disabled: Story = {
  args: {
    hint: "Ask an owner to change it.",
    children: <Input type="email" defaultValue="ada@example.com" disabled />,
  },
};

export const WithTextarea: Story = {
  args: {
    label: "Message",
    htmlFor: "message",
    hint: "Up to 500 characters.",
    error: "Tell us a little more: 10 characters at least.",
    children: <Textarea defaultValue="Too short" />,
  },
};

/** The field wires the trigger, the one element of a Select that takes an id and aria attributes. */
function RoleSelect(props: React.ComponentProps<typeof SelectTrigger>) {
  return (
    <Select>
      <SelectTrigger className="w-full" {...props}>
        <SelectValue placeholder="Pick a role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="owner">Owner</SelectItem>
        <SelectItem value="editor">Editor</SelectItem>
        <SelectItem value="viewer">Viewer</SelectItem>
      </SelectContent>
    </Select>
  );
}

export const WithSelect: Story = {
  args: {
    label: "Role",
    htmlFor: "role",
    hint: "Owners can manage billing.",
    error: "Pick a role for this member.",
    children: <RoleSelect />,
  },
};

/** Three fields, the way a form stacks them. */
export const InAForm: Story = {
  render: () => (
    <form className="grid gap-4">
      <Field label="Name" htmlFor="form-name" required>
        <Input defaultValue="Ada Lovelace" />
      </Field>
      <Field
        label="Email"
        htmlFor="form-email"
        hint="We only use it to send you the receipt."
        required
      >
        <Input type="email" placeholder="you@example.com" />
      </Field>
      <Field
        label="Message"
        htmlFor="form-message"
        error="Tell us a little more: 10 characters at least."
      >
        <Textarea defaultValue="Too short" />
      </Field>
    </form>
  ),
};

/** A long French label, hint and error in a narrow column: they wrap, nothing is cut. */
export const LongLabel: Story = {
  args: {
    label:
      "Adresse e-mail professionnelle de la personne à inviter dans l'espace de travail",
    htmlFor: "long",
    required: true,
    hint: "Nous lui enverrons une invitation valable sept jours, qu'elle pourra accepter depuis n'importe quel appareil.",
    error:
      "Cette adresse ne ressemble pas à une adresse e-mail : vérifiez qu'elle contient un « @ » et un nom de domaine.",
    children: <Input type="email" defaultValue="ada.lovelace" />,
  },
  decorators: [
    (Story) => (
      <div className="w-64 max-w-full">
        <Story />
      </div>
    ),
  ],
};
