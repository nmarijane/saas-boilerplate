import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MAX_MESSAGE_LENGTH, MESSAGE_COUNT_FROM } from "@/features/ai/config/chat";
import { messageLimit } from "@/features/ai/message-limit";

/**
 * Where a message stands against the longest one the route takes. The composer
 * keeps whatever is typed or pasted, shows the count near the limit and refuses
 * to send past it: it counts what would be sent, as the route counts it.
 */

describe("where a message stands against the limit", () => {
  it("is within it when it is short, or when there is nothing yet", () => {
    expect(messageLimit("")).toEqual({ state: "within", length: 0 });
    expect(messageLimit("Draft the launch email")).toEqual({ state: "within", length: 22 });
  });

  it("shows the count from nine tenths of the limit, and not before", () => {
    expect(MESSAGE_COUNT_FROM).toBe(Math.floor(MAX_MESSAGE_LENGTH * 0.9));

    expect(messageLimit("x".repeat(MESSAGE_COUNT_FROM - 1)).state).toBe("within");
    expect(messageLimit("x".repeat(MESSAGE_COUNT_FROM))).toEqual({ state: "near", length: MESSAGE_COUNT_FROM });
  });

  it("still takes a message that is exactly the limit, and refuses the one that is a character longer", () => {
    expect(messageLimit("x".repeat(MAX_MESSAGE_LENGTH))).toEqual({ state: "near", length: MAX_MESSAGE_LENGTH });
    expect(messageLimit("x".repeat(MAX_MESSAGE_LENGTH + 1))).toEqual({ state: "over", length: MAX_MESSAGE_LENGTH + 1 });
  });

  it("counts the whole of a paste that is far over the limit, never a cut of it", () => {
    expect(messageLimit("x".repeat(12_000))).toEqual({ state: "over", length: 12_000 });
  });

  // The chat sends the text trimmed (chat.tsx): the spaces around it are not part of the message
  it("counts what is sent, the text without the spaces around it", () => {
    const padded = `  \n${"x".repeat(MAX_MESSAGE_LENGTH)}\n\n  `;

    expect(messageLimit(padded)).toEqual({ state: "near", length: MAX_MESSAGE_LENGTH });
    expect(messageLimit("   ")).toEqual({ state: "within", length: 0 });
  });

  // `z.string().max()` of the route counts characters, code points, in Zod 4: an emoji is one,
  // though it takes two UTF-16 units. A count by `.length` would refuse what the route takes.
  it("counts an emoji as one character, as the route does: 8,000 of them are the limit, not twice over", () => {
    expect(messageLimit("😀".repeat(MAX_MESSAGE_LENGTH))).toEqual({ state: "near", length: MAX_MESSAGE_LENGTH });
    expect(messageLimit("😀".repeat(MAX_MESSAGE_LENGTH + 1))).toEqual({ state: "over", length: MAX_MESSAGE_LENGTH + 1 });
  });

  it("agrees with the route on what is too long, whatever the letters are made of", () => {
    const route = z.string().max(MAX_MESSAGE_LENGTH);
    const texts = [
      "x".repeat(MAX_MESSAGE_LENGTH),
      "x".repeat(MAX_MESSAGE_LENGTH + 1),
      "😀".repeat(MAX_MESSAGE_LENGTH),
      "😀".repeat(MAX_MESSAGE_LENGTH + 1),
      "😀".repeat(MAX_MESSAGE_LENGTH / 2 + 1),
      `é${"x".repeat(MAX_MESSAGE_LENGTH - 1)}`,
      `${"x".repeat(MAX_MESSAGE_LENGTH - 1)}😀`,
      `${"x".repeat(MAX_MESSAGE_LENGTH)}😀`,
      "日本語".repeat(3000),
    ];

    for (const text of texts) {
      expect(messageLimit(text).state !== "over", `${text.length} units`).toBe(route.safeParse(text).success);
    }
  });
});
