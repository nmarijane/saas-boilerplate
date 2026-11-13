import type { ComponentProps } from "react";
import { createElement } from "react";

type TextareaModule = typeof import("@/shared/components/ui/textarea");

/** The props of a `Textarea`, as a form hands them over. */
export type TextareaProps = ComponentProps<TextareaModule["Textarea"]>;

/**
 * The props of every Textarea drawn since `forgetTextareas()`, in order. A key
 * pressed in a field cannot be made in static markup, so a test reads the
 * handler where it is handed over (`textareaProps[0].onKeyDown`).
 */
export const textareaProps: TextareaProps[] = [];

/** Starts the list over: call it before each test. */
export function forgetTextareas(): void {
  textareaProps.length = 0;
}

/**
 * The textarea module with a `Textarea` that keeps its props in `textareaProps`
 * and still draws the real one. It is given the module `vi.mock` hands its
 * factory:
 *
 *     vi.mock("@/shared/components/ui/textarea", async (importOriginal) => {
 *       const { spyOnTextarea } = await import("../../helpers/textarea-spy");
 *       return spyOnTextarea(await importOriginal<typeof import("@/shared/components/ui/textarea")>());
 *     });
 */
export function spyOnTextarea(actual: TextareaModule): TextareaModule {
  return {
    ...actual,
    Textarea: (props: TextareaProps) => {
      textareaProps.push(props);
      return createElement(actual.Textarea, props);
    },
  };
}
