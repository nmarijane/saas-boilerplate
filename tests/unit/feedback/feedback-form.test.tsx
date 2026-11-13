import type { ReactNode } from "react";
import type { FeedbackFormState } from "@/features/feedback/feedback-form-state";
import { describe, expect, it } from "vitest";
import { FeedbackForm } from "@/features/feedback/components/feedback-form";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

const WRITTEN: FeedbackFormState = {
  type: "bug",
  message: "The export button does nothing.",
  sending: false,
  failed: false,
};

function render(
  form: Partial<FeedbackFormState> = {},
  locale: "en" | "fr" = "en",
  children?: ReactNode,
): string {
  return renderWithIntl(
    <FeedbackForm
      form={{ ...WRITTEN, ...form }}
      onTypeChange={() => {}}
      onMessageChange={() => {}}
      onSend={() => {}}
    >
      {children}
    </FeedbackForm>,
    locale,
  );
}

/** The start tag of the button that sends: the last of the form. */
function sendTag(html: string): string {
  const [last = ""] = elements(html, "button").slice(-1);
  return startTags(last, "button")[0] ?? "";
}

const sendLabel = (html: string) => textOf(elements(html, "button").slice(-1)[0] ?? "");

// The classes of a button name `disabled:` and `data-loading:`: it is the attributes that tell.
const isDisabled = (tag: string) => /\sdisabled[=\s>]/.test(tag);
const isLoading = (tag: string) => /\sdata-loading[=\s>]/.test(tag);

describe("the feedback form", () => {
  describe("at rest", () => {
    const html = render();

    it("asks for a type and a message, each under its label", () => {
      expect(textOf(html)).toContain("Type");
      expect(textOf(html)).toContain("Message");
      expect(attribute(startTags(html, "textarea")[0] ?? "", "id")).toBe("feedback-message");
    });

    it("holds the message that was written", () => {
      expect(textOf(elements(html, "textarea")[0] ?? "")).toBe(WRITTEN.message);
    });

    it("stops the message at the length the server accepts", () => {
      expect(attribute(startTags(html, "textarea")[0] ?? "", "maxLength")).toBe("5000");
    });

    it("offers to send, with a button that works", () => {
      expect(sendLabel(html)).toBe("Send feedback");
      expect(isDisabled(sendTag(html))).toBe(false);
      expect(attribute(sendTag(html), "aria-disabled")).toBeUndefined();
    });

    it("says nothing is wrong", () => {
      expect(html).not.toContain('role="alert"');
    });
  });

  it("does not offer to send an empty message, whitespace aside", () => {
    for (const message of ["", "   \n "]) {
      expect(isDisabled(sendTag(render({ message }))), JSON.stringify(message)).toBe(true);
    }
  });

  describe("while the feedback is sent", () => {
    const html = render({ sending: true });

    it("makes the button wait, and keeps the focus on it: it is loading, not disabled", () => {
      const tag = sendTag(html);

      expect(attribute(tag, "aria-disabled")).toBe("true");
      expect(isLoading(tag)).toBe(true);
      expect(isDisabled(tag)).toBe(false);
    });

    it("says what is going on", () => {
      expect(sendLabel(html)).toContain("Sending…");
    });
  });

  describe("when the feedback was refused", () => {
    const html = render({ failed: true });

    it("shows the error, as an alert that the screen reader announces", () => {
      const [alert = ""] = startTags(html, "div").filter((tag) => tag.includes('role="alert"'));

      expect(alert).toContain('data-slot="page-alert"');
      expect(textOf(html)).toContain("We couldn't send your feedback. Please try again.");
    });

    it("keeps the message the person wrote", () => {
      expect(textOf(elements(html, "textarea")[0] ?? "")).toBe(WRITTEN.message);
    });

    it("gives the button back, ready for another try", () => {
      expect(sendLabel(html)).toBe("Send feedback");
      expect(isDisabled(sendTag(html))).toBe(false);
      expect(isLoading(sendTag(html))).toBe(false);
      expect(attribute(sendTag(html), "aria-disabled")).toBeUndefined();
    });

    it("puts the error between the message and the button, where the eye is", () => {
      expect(html.indexOf("<textarea")).toBeLessThan(html.indexOf('role="alert"'));
      expect(html.indexOf('role="alert"')).toBeLessThan(html.lastIndexOf("<button"));
    });

    it("speaks French", () => {
      expect(textOf(render({ failed: true }, "fr"))).toContain(
        "Impossible d'envoyer votre feedback. Veuillez réessayer.",
      );
    });
  });

  describe("what a project adds to it", () => {
    it("comes between the message and the button, and nothing is there without it", () => {
      const html = render({}, "en", <p data-extra="">Attach a file</p>);

      expect(html.indexOf("<textarea")).toBeLessThan(html.indexOf("data-extra"));
      expect(html.indexOf("data-extra")).toBeLessThan(html.lastIndexOf("<button"));
      expect(render()).not.toContain("data-extra");
    });
  });

  it("is a column of fields as wide as the dialog, the button too", () => {
    expect(decodedClassesOf(sendTag(render()))).toContain("w-full");
  });
});
