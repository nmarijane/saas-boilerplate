import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hardCodedCopy } from "../../helpers/copy";

const ROOT = resolve(import.meta.dirname, "../../..");

/**
 * The components the shell mounts for a feature (the bell and its panel, the
 * feedback row and its dialog): every word they show comes from the message
 * files, which hold it in both languages (messages-parity.test.ts).
 */
const MOUNTED = [
  "src/features/notifications/components/notification-bell.tsx",
  "src/features/notifications/components/notification-center.tsx",
  "src/features/notifications/components/notification-row.tsx",
  "src/features/notifications/components/notifications-provider.tsx",
  "src/features/feedback/components/feedback-button.tsx",
  "src/features/feedback/components/feedback-form.tsx",
  "src/features/feedback/components/feedback-modal.tsx",
  "src/features/feedback/components/feedback-nav-button.tsx",
];

describe("hardCodedCopy", () => {
  it("finds the text between tags and in the attributes a person reads", () => {
    const source = `
      export const A = () => (
        <div className="flex" title="Tooltip">
          <p>Hello</p>
          <input placeholder="Search" aria-label={"Name"} type="text" />
          {"Close"}
        </div>
      );
    `;

    expect(hardCodedCopy(source)).toEqual([
      'title="Tooltip"',
      "Hello",
      'placeholder="Search"',
      'aria-label="Name"',
      "Close",
    ]);
  });

  it("finds the words on either side of a condition, and in a template", () => {
    const source = `
      export const A = ({ busy, name }: { busy: boolean; name: string }) => (
        <div>
          <button>{busy ? "Saving…" : "Save"}</button>
          <button aria-label={busy ? "Wait" : undefined}>{name && "Hello"}</button>
          <p>{\`Hi \${name}\`}</p>
        </div>
      );
    `;

    expect(hardCodedCopy(source)).toEqual([
      "Saving…",
      "Save",
      'aria-label="Wait"',
      "Hello",
      "Hi ",
    ]);
  });

  it("leaves code, spaces and symbols alone", () => {
    const source = `
      export const A = ({ label, busy }: { label: string; busy: boolean }) => (
        <button type="button" className={busy ? "min-h-11" : "min-h-9"} data-slot="x" aria-label={label}>
          {label}{" "}…
          <span aria-hidden="true">·</span>
        </button>
      );
    `;

    expect(hardCodedCopy(source)).toEqual([]);
  });
});

describe("the components mounted in the shell", () => {
  it.each(MOUNTED)("write no word of their own: %s", (path) => {
    expect(hardCodedCopy(readFileSync(resolve(ROOT, path), "utf-8"))).toEqual([]);
  });
});

/**
 * The steps of onboarding and its way out, and the page the verification link
 * lands on: a person reads them in their own language, and what an English
 * default would say on a page in French is what a refusal of the server says, which
 * these never show (the words are the message files', or nobody's).
 */
const ONBOARDING = [
  "src/features/onboarding/components/onboarding-wizard.tsx",
  "src/features/onboarding/components/profile-step.tsx",
  "src/features/onboarding/components/workspace-step.tsx",
  "src/features/onboarding/components/sign-out-button.tsx",
  "src/app/[locale]/(auth)/(center)/verify-email/page.tsx",
];

describe("the steps of onboarding, its way out and the verify page", () => {
  it.each(ONBOARDING)("write no word of their own: %s", (path) => {
    expect(hardCodedCopy(readFileSync(resolve(ROOT, path), "utf-8"))).toEqual([]);
  });
});

/**
 * The assistant: its page (the empty state of a workspace with no provider, and
 * the title only a screen reader sees) and every component of its chat. A word of
 * theirs is the message files', in both languages: what an English default would
 * say on a page in French is what the route's refusals say, which none of them
 * shows.
 */
const ASSISTANT = [
  "src/app/[locale]/(app)/(shell)/ai/page.tsx",
  "src/features/ai/components/chat.tsx",
  "src/features/ai/components/chat-error.tsx",
  "src/features/ai/components/chat-input.tsx",
  "src/features/ai/components/chat-message.tsx",
  "src/features/ai/components/credit-balance.tsx",
  "src/features/ai/components/model-selector.tsx",
];

describe("the assistant", () => {
  it.each(ASSISTANT)("writes no word of its own: %s", (path) => {
    expect(hardCodedCopy(readFileSync(resolve(ROOT, path), "utf-8"))).toEqual([]);
  });
});
