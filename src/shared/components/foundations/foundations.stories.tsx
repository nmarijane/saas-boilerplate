import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Names only, so there is no copy to translate. The colors are the raw tokens
// of theme.css, grouped by role.
const colorGroups = [
  [
    "--ink",
    "--ink-soft",
    "--ink-muted",
    "--surface",
    "--surface-sunken",
    "--surface-raised",
    "--hairline",
    "--control-border",
  ],
  [
    "--brand",
    "--brand-2",
    "--brand-on",
    "--brand-tint",
    "--brand-tint-ink",
    "--focus-ring",
    "--gradient-signature",
  ],
  [
    "--success",
    "--success-text",
    "--success-bg",
    "--warning-bg",
    "--warning-text",
    "--warning-bar",
    "--danger",
    "--danger-text",
    "--danger-bg",
    "--danger-on",
  ],
  ["--track", "--bar"],
  ["--side-bg", "--side-active-bg", "--side-hover-bg"],
  [
    "--tone-1",
    "--tone-2",
    "--tone-3",
    "--tone-4",
    "--tone-1-ink",
    "--tone-2-ink",
    "--tone-3-ink",
    "--tone-4-ink",
  ],
  [
    "--btn-primary-hover",
    "--btn-primary-active",
    "--btn-primary-edge",
    "--btn-danger-hover",
    "--btn-danger-active",
  ],
  ["--scrim"],
] as const;

// The utilities below are written in full so that Tailwind generates them.
const typeScale = [
  "text-caption",
  "text-meta",
  "text-body",
  "text-section",
  "text-panel",
  "text-entity",
  "text-page",
  "text-key",
] as const;

const radii = [
  { utility: "rounded-xs", token: "--corner-xs" },
  { utility: "rounded-sm", token: "--corner-sm" },
  { utility: "rounded-md", token: "--corner-field" },
  { utility: "rounded-lg", token: "--corner-card" },
  { utility: "rounded-xl", token: "--corner-dialog" },
] as const;

const shadows = [
  { utility: "shadow-card", token: "--elevation-card" },
  { utility: "shadow-pop", token: "--elevation-pop" },
] as const;

function Swatch({ token }: { token: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <span
        className="size-10 shrink-0 rounded-full border border-control"
        style={{ background: `var(${token})` }}
      />
      <code className="min-w-0 font-mono text-meta wrap-anywhere">{token}</code>
    </li>
  );
}

// The utility is what a component writes, the token is what theme.css edits.
function Names({ utility, token }: { utility: string; token: string }) {
  return (
    <div className="flex flex-col">
      <code className="font-mono text-meta">{utility}</code>
      <code className="font-mono text-caption text-ink-muted">{token}</code>
    </div>
  );
}

const meta = {
  title: "Foundations/Tokens",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Colors: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {colorGroups.map(group => (
        <ul
          key={group[0]}
          className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3"
        >
          {group.map(token => (
            <Swatch key={token} token={token} />
          ))}
        </ul>
      ))}
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <ul className="flex flex-col gap-4 font-display">
      {typeScale.map(step => (
        <li key={step} className={step}>
          {step}
        </li>
      ))}
    </ul>
  ),
};

export const Radii: Story = {
  render: () => (
    <ul className="flex flex-wrap gap-8">
      {radii.map(({ utility, token }) => (
        <li key={utility} className="flex flex-col gap-3">
          <div className={`size-24 border border-control bg-card ${utility}`} />
          <Names utility={utility} token={token} />
        </li>
      ))}
    </ul>
  ),
};

// A card and a popover both carry a 1 px hairline, as the samples do: in dark a
// black shadow alone does not show the edge of a surface.
export const Shadows: Story = {
  render: () => (
    <ul className="flex flex-wrap gap-12">
      {shadows.map(({ utility, token }) => (
        <li key={utility} className="flex flex-col gap-6">
          <div className={`h-24 w-48 rounded-lg border bg-card ${utility}`} />
          <Names utility={utility} token={token} />
        </li>
      ))}
    </ul>
  ),
};
