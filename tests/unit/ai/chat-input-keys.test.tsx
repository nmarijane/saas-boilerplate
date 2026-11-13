import type { KeyboardEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatInput } from "@/features/ai/components/chat-input";
import { renderWithIntl } from "../../helpers/intl";
import { forgetTextareas, textareaProps } from "../../helpers/textarea-spy";

// A key pressed in the field cannot be made in static markup, so its handlers are read
// where the composer hands them over (tests/helpers/textarea-spy.ts). The plays of the
// stories press the same keys in a browser: a person sees the same.
vi.mock("@/shared/components/ui/textarea", async (importOriginal) => {
  const { spyOnTextarea } = await import("../../helpers/textarea-spy");
  return spyOnTextarea(await importOriginal<typeof import("@/shared/components/ui/textarea")>());
});

/**
 * Enter sends the message, and Shift and Enter writes a new line. The Enter that
 * ends a composition of an input method (Japanese, Chinese, Korean: the person
 * picks a candidate with it) is not for the composer: it sends nothing. Chrome and
 * Firefox say so on the key (`isComposing`). Safari ends the composition first
 * (`compositionend`), then sends the Enter with `isComposing` already false, in
 * the same tick.
 */

beforeEach(() => {
  forgetTextareas();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** The handler the composer handed its field, by its name. */
function handlerOf<Name extends "onKeyDown" | "onCompositionStart" | "onCompositionEnd">(name: Name) {
  const handler = textareaProps[0]?.[name];
  if (!handler) {
    throw new Error(`The composer handed its field no ${name}`);
  }

  return handler;
}

/** The composer, drawn once: what it was asked to send, and the keys and the composition of the person, as its field is told of them. */
function composer(input = "Draft the launch email") {
  const onSubmit = vi.fn();
  renderWithIntl(<ChatInput input={input} isLoading={false} onInputChange={() => {}} onSubmit={onSubmit} onStop={() => {}} />);

  /** A key down, as React hands it over; `prevented` tells whether the composer kept the key from doing what it does in a field. */
  function press({ shiftKey = false, isComposing = false } = {}) {
    let prevented = false;
    handlerOf("onKeyDown")({
      key: "Enter",
      shiftKey,
      nativeEvent: { isComposing },
      preventDefault: () => {
        prevented = true;
      },
    } as unknown as KeyboardEvent<HTMLTextAreaElement>);

    return { prevented };
  }

  return {
    onSubmit,
    enter: (isComposing = false) => press({ isComposing }),
    shiftEnter: () => press({ shiftKey: true }),
    startComposition: () => handlerOf("onCompositionStart")({} as never),
    endComposition: () => handlerOf("onCompositionEnd")({} as never),
  };
}

describe("the keys of the composer", () => {
  it("sends the message with Enter, and keeps the key from writing a new line", () => {
    const { onSubmit, enter } = composer();

    expect(enter().prevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("sends nothing with Shift and Enter: it writes a new line", () => {
    const { onSubmit, shiftEnter } = composer();

    expect(shiftEnter().prevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends nothing with Enter while the message is empty, and writes no new line either", () => {
    const { onSubmit, enter } = composer("   ");

    expect(enter().prevented).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  describe("while an input method composes", () => {
    it("sends nothing with the Enter that picks a candidate: the key says it is composing", () => {
      const { onSubmit, enter } = composer();

      expect(enter(true).prevented).toBe(false);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("sends nothing with the Enter that comes just after the composition ended, in the same tick: Safari's order", () => {
      const { onSubmit, enter, startComposition, endComposition } = composer();

      startComposition();
      endComposition();
      enter();

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("sends with the Enter that comes after that tick", () => {
      const { onSubmit, enter, startComposition, endComposition } = composer();

      startComposition();
      endComposition();
      vi.advanceTimersByTime(0);
      enter();

      expect(onSubmit).toHaveBeenCalledOnce();
    });

    it("sends nothing while the composition goes on, whatever the key says", () => {
      const { onSubmit, enter, startComposition } = composer();

      startComposition();
      enter();
      vi.advanceTimersByTime(1000);
      enter();

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("is not cut short by the end of the composition before: a new one that starts in that tick goes on", () => {
      const { onSubmit, enter, startComposition, endComposition } = composer();

      startComposition();
      endComposition();
      startComposition();
      vi.advanceTimersByTime(0);
      enter();

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
