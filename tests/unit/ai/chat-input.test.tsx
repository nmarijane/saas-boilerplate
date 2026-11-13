import { describe, expect, it } from "vitest";
import { ChatInput } from "@/features/ai/components/chat-input";
import { MAX_MESSAGE_LENGTH, MESSAGE_COUNT_FROM } from "@/features/ai/config/chat";
import { attribute, classesOf, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

/**
 * The composer of the assistant, drawn as it is for a text typed or pasted. It
 * keeps all of it (a `maxLength` would cut a paste without a word), shows the
 * count near the limit the route takes, and past it refuses to send, with a
 * message next to the field that a screen reader hears politely. What pressing
 * Enter does is the job of the plays of its stories: Node has no DOM to press in.
 */

type Locale = "en" | "fr";

function draw(input: string, { isLoading = false, locale = "en" }: { isLoading?: boolean; locale?: Locale } = {}) {
  return renderWithIntl(
    <ChatInput input={input} isLoading={isLoading} onInputChange={() => {}} onSubmit={() => {}} onStop={() => {}} />,
    locale,
  );
}

const textareaOf = (html: string) => startTags(html, "textarea")[0] ?? "";
const sendOf = (html: string, name = "Send message") =>
  elements(html, "button").find((button) => textOf(button) === name) ?? "";
/** The live region of the composer: the one element that says what is wrong with the length. */
const statusOf = (html: string) => elements(html, "p").find((paragraph) => /role="status"/.test(paragraph)) ?? "";

describe("the composer of the assistant", () => {
  describe("keeps what is typed or pasted", () => {
    it("sets no maxlength: the field would cut a paste at the limit, and say nothing", () => {
      const field = textareaOf(draw(""));

      expect(attribute(field, "maxLength")).toBeUndefined();
      expect(field.toLowerCase()).not.toContain("maxlength");
    });

    it("holds the whole of a paste of 12,000 characters, not its first 8,000", () => {
      const html = draw("x".repeat(12_000));

      expect(textOf(elements(html, "textarea")[0] ?? "")).toHaveLength(12_000);
    });
  });

  describe("within the limit", () => {
    it("shows no count, and its live region is there, empty, so that the first thing it says is heard", () => {
      const html = draw("Draft the launch email");

      expect(textOf(html)).not.toContain("/ 8,000");
      expect(statusOf(html)).not.toBe("");
      expect(textOf(statusOf(html))).toBe("");
    });

    it("lets a message be sent, and not an empty one", () => {
      expect(attribute(startTags(sendOf(draw("Hello")), "button")[0] ?? "", "disabled")).toBeUndefined();
      expect(attribute(startTags(sendOf(draw("")), "button")[0] ?? "", "disabled")).toBe("");
      expect(attribute(startTags(sendOf(draw("   \n ")), "button")[0] ?? "", "disabled")).toBe("");
    });

    it("is not marked invalid", () => {
      expect(attribute(textareaOf(draw("Hello")), "aria-invalid")).toBeUndefined();
    });
  });

  describe("near the limit", () => {
    it("shows the count as `7,950 / 8,000`, in the format of the language", () => {
      expect(textOf(draw("x".repeat(7_950)))).toContain("7,950 / 8,000");
      // Narrow no-break spaces between the groups, as `Intl` writes French
      expect(textOf(draw("x".repeat(7_950), { locale: "fr" }))).toMatch(/7\s950 \/ 8\s000/u);
    });

    it("starts at nine tenths of the limit", () => {
      expect(textOf(draw("x".repeat(MESSAGE_COUNT_FROM - 1)))).not.toContain("/ 8,000");
      expect(textOf(draw("x".repeat(MESSAGE_COUNT_FROM)))).toContain("/ 8,000");
    });

    it("says politely that the limit is near, in a status region that stays out of sight", () => {
      const status = statusOf(draw("x".repeat(7_950)));

      expect(textOf(status)).toBe("You're close to the limit of 8,000 characters.");
      expect(classesOf(startTags(status, "p")[0] ?? "")).toContain("sr-only");
    });

    it("keeps the sentence of the live region the same from one character to the next: it is heard when the limit comes near, not at each key", () => {
      const sentences = new Set([7_300, 7_500, 7_950, MAX_MESSAGE_LENGTH].map((length) => textOf(statusOf(draw("x".repeat(length))))));

      expect(sentences.size).toBe(1);
    });

    it("still lets a message that is exactly the limit be sent", () => {
      const html = draw("x".repeat(MAX_MESSAGE_LENGTH));

      expect(attribute(startTags(sendOf(html), "button")[0] ?? "", "disabled")).toBeUndefined();
      expect(attribute(textareaOf(html), "aria-invalid")).toBeUndefined();
    });
  });

  describe("over the limit", () => {
    const over = () => draw("x".repeat(MAX_MESSAGE_LENGTH + 1));

    it("refuses to send: the button is off", () => {
      expect(attribute(startTags(sendOf(over()), "button")[0] ?? "", "disabled")).toBe("");
    });

    it("refuses a paste of 12,000 characters too, and shows how far over it is", () => {
      const html = draw("x".repeat(12_000));

      expect(attribute(startTags(sendOf(html), "button")[0] ?? "", "disabled")).toBe("");
      expect(textOf(html)).toContain("12,000 / 8,000");
    });

    it("says why, next to the field, in the words of the page, and marks the field invalid", () => {
      const html = over();
      const status = statusOf(html);

      expect(textOf(status)).toBe("This message is over the limit of 8,000 characters. Shorten it to send it.");
      expect(classesOf(startTags(status, "p")[0] ?? "")).toContain("text-danger-text");
      expect(classesOf(startTags(status, "p")[0] ?? "")).not.toContain("sr-only");
      expect(attribute(textareaOf(html), "aria-invalid")).toBe("true");
    });

    it("says it in French", () => {
      const html = draw("x".repeat(MAX_MESSAGE_LENGTH + 1), { locale: "fr" });
      const max = new Intl.NumberFormat("fr").format(MAX_MESSAGE_LENGTH);

      expect(textOf(statusOf(html))).toBe(`Ce message dépasse la limite de ${max} caractères. Raccourcissez-le pour l'envoyer.`);
    });

    it("announces politely: a status, which waits for the screen reader, never an alert that interrupts it", () => {
      const status = statusOf(over());

      expect(status).toContain('role="status"');
      expect(status).not.toContain('role="alert"');
    });

    it("puts the field under the description of both the sentence and the count, so that they are read with the field", () => {
      const html = over();
      const described = (attribute(textareaOf(html), "aria-describedby") ?? "").split(" ");
      const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id);

      expect(described).toHaveLength(2);
      for (const id of described) {
        expect(ids).toContain(id);
      }
    });

    it("draws the count in the color of an error, with the number of characters typed", () => {
      const count = elements(over(), "p").find((paragraph) => textOf(paragraph).includes(" / ")) ?? "";

      expect(textOf(count)).toBe("8,001 / 8,000");
      expect(classesOf(startTags(count, "p")[0] ?? "")).toContain("text-danger-text");
    });
  });

  describe("while it answers", () => {
    it("offers to stop, in place of sending", () => {
      const html = draw("Hello", { isLoading: true });

      expect(sendOf(html)).toBe("");
      expect(sendOf(html, "Stop generation")).not.toBe("");
    });
  });

  describe("its words", () => {
    it("come from the message files: in both languages, none is English on a page in French", () => {
      const fr = draw("", { locale: "fr" });

      expect(attribute(textareaOf(fr), "placeholder")).toBe("Envoyer un message…");
      expect(attribute(textareaOf(fr), "aria-label")).toBe("Message");
      expect(sendOf(fr, "Envoyer le message")).not.toBe("");
      expect(textOf(fr)).not.toContain("Send");
      expect(attribute(textareaOf(draw("")), "placeholder")).toBe("Send a message…");
    });

    it("name the field for a screen reader: a placeholder is not a name", () => {
      expect(attribute(textareaOf(draw("")), "aria-label")).toBe("Message");
    });
  });
});
