import { describe, expect, it } from "vitest";
import { FeedbackButton } from "@/features/feedback/components/feedback-button";
import { FeedbackNavButton } from "@/features/feedback/components/feedback-nav-button";
import { feedbackShell } from "@/features/feedback/shell";
import { navRowStyles } from "@/shared/components/shell/nav-row";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
  tokens,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

/** The one button of the feedback control. */
function buttonOf(html: string): string {
  return startTags(html, "button")[0] ?? "";
}

describe("feedback button", () => {
  it("draws the feedback row like a navigation row", () => {
    const html = renderWithIntl(<FeedbackButton variant="nav" />);
    const classes = decodedClassesOf(buttonOf(html));

    expect(textOf(html)).toBe("Send feedback");
    expect(classes).toContain("min-h-11");
    // The very styles of the rows of the navigation, not a copy of them.
    expect(classes).toEqual(expect.arrayContaining(tokens(navRowStyles)));
  });

  it("puts the label in a span that is cut when it is too long, after an icon that stays", () => {
    const html = renderWithIntl(<FeedbackButton variant="nav" />);

    expect(html).toContain("lucide-message-square");
    expect(attribute(startTags(html, "svg")[0] ?? "", "aria-hidden")).toBe("true");
    expect(html).toContain('<span class="truncate">Send feedback</span>');
  });

  it("says that it opens a dialog, which is closed", () => {
    const tag = buttonOf(renderWithIntl(<FeedbackButton variant="nav" />));

    expect(attribute(tag, "type")).toBe("button");
    expect(attribute(tag, "aria-haspopup")).toBe("dialog");
    expect(attribute(tag, "aria-expanded")).toBe("false");
  });

  it("speaks French", () => {
    expect(textOf(renderWithIntl(<FeedbackButton variant="nav" />, "fr"))).toBe(
      "Envoyer un feedback",
    );
  });

  it("is an icon button with a name, and no label, when it is not a row", () => {
    const html = renderWithIntl(<FeedbackButton />);
    const tag = buttonOf(html);

    expect(attribute(tag, "aria-label")).toBe("Send feedback");
    expect(textOf(html)).toBe("");
    expect(decodedClassesOf(tag)).toContain("size-10");
    expect(html).toContain("lucide-message-square");
    expect(attribute(tag, "aria-haspopup")).toBe("dialog");
    expect(elements(html, "button")).toHaveLength(1);
  });

  it("keeps the dialog closed until the button is pressed", () => {
    for (const variant of ["icon", "nav"] as const) {
      const html = renderWithIntl(<FeedbackButton variant={variant} />);

      expect(html).not.toContain('role="dialog"');
    }
  });
});

describe("feedback in the shell", () => {
  it("adds one row under the secondary navigation, and nothing else", () => {
    expect(feedbackShell.id).toBe("feedback");
    expect(feedbackShell.SidebarActions).toEqual([FeedbackNavButton]);
    expect(feedbackShell.nav).toBeUndefined();
    expect(feedbackShell.Provider).toBeUndefined();
    expect(feedbackShell.Notifications).toBeUndefined();
  });

  it("draws the navigation variant of the button", () => {
    expect(renderWithIntl(<FeedbackNavButton />)).toBe(
      renderWithIntl(<FeedbackButton variant="nav" />),
    );
  });
});
