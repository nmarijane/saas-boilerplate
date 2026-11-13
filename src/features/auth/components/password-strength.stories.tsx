import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { expect, userEvent, within } from "storybook/test";
import { Field } from "@/shared/components/ui/field";
import { PasswordInput } from "@/shared/components/ui/password-input";
import { PasswordStrength } from "./password-strength";

// The strength of a new password, under its field: one bar for each of the five
// rules that pass, and the rules, each told by an icon (a check or a cross) and
// by words that only assistive technology hears ("met", "not met"), never by
// color alone.

const meta = {
  title: "Features/PasswordStrength",
  component: PasswordStrength,
  tags: ["autodocs"],
  args: { password: "abc" },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PasswordStrength>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What the words say, rule by rule, in the order of the list. */
function said(canvas: ReturnType<typeof within>): string[] {
  return canvas.getAllByRole("listitem").map((item: HTMLElement) => item.querySelector(".sr-only")?.textContent ?? "");
}

/** A field with the meter under it, which keeps what is typed, as a form does. */
function Typing() {
  const [password, setPassword] = React.useState("");

  return (
    <div className="grid gap-3">
      <Field label="Password" htmlFor="strength-field">
        <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-11" />
      </Field>
      <PasswordStrength password={password} />
    </div>
  );
}

/** One rule passes: one bar, in the tone of danger, one check and four crosses. */
export const Weak: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole("listitem")).toHaveLength(5);
    await expect(said(canvas)).toEqual(["not met", "not met", "met", "not met", "not met"]);
  },
};

/** Four rules pass: four bars, in the tone of warning. */
export const Almost: Story = {
  args: { password: "Abcdefg1" },
  play: async ({ canvasElement }) => {
    await expect(said(within(canvasElement))).toEqual(["met", "met", "met", "met", "not met"]);
  },
};

/** Every rule passes: five bars, in the tone of success, five checks. */
export const Strong: Story = {
  args: { password: "Abcdefg1!" },
  play: async ({ canvasElement }) => {
    await expect(said(within(canvasElement))).toEqual(["met", "met", "met", "met", "met"]);
  },
};

/** An empty field says nothing: no bars, no list. */
export const Empty: Story = {
  args: { password: "" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("list")).not.toBeInTheDocument();
  },
};

/** The meter follows what is typed, rule by rule. */
export const FollowsTheTyping: Story = {
  render: () => <Typing />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText("Password");

    await expect(canvas.queryByRole("list")).not.toBeInTheDocument();
    await userEvent.type(field, "abc");
    await expect(said(canvas)).toEqual(["not met", "not met", "met", "not met", "not met"]);
    await userEvent.type(field, "DEFG12!");
    await expect(said(canvas)).toEqual(["met", "met", "met", "met", "met"]);
  },
};

/** The same meter in French: « respecté » and « non respecté » for those who hear it. */
export const French: Story = {
  globals: { locale: "fr" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(said(canvas)).toEqual(["non respecté", "non respecté", "respecté", "non respecté", "non respecté"]);
    await expect(canvas.getByText("Au moins 8 caractères")).toBeVisible();
  },
};
