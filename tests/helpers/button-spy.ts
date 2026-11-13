import type { ComponentProps } from "react";
import { createElement } from "react";

type ButtonModule = typeof import("@/shared/components/ui/button");

/** The props of a `Button`, as a state hands them over. */
export type ButtonProps = ComponentProps<ButtonModule["Button"]>;

/**
 * The props of every Button drawn since `forgetButtons()`, in order. The click
 * of a button cannot be made in static markup, so a test reads the handler where
 * it is handed over (`buttonProps[0].onClick`).
 */
export const buttonProps: ButtonProps[] = [];

/** Starts the list over: call it before each test. */
export function forgetButtons(): void {
  buttonProps.length = 0;
}

/**
 * The button module with a `Button` that keeps its props in `buttonProps` and
 * still draws the real one. It is given the module `vi.mock` hands its factory:
 *
 *     vi.mock("@/shared/components/ui/button", async (importOriginal) => {
 *       const { spyOnButton } = await import("../../helpers/button-spy");
 *       return spyOnButton(await importOriginal<typeof import("@/shared/components/ui/button")>());
 *     });
 */
export function spyOnButton(actual: ButtonModule): ButtonModule {
  return {
    ...actual,
    Button: (props: ButtonProps) => {
      buttonProps.push(props);
      return createElement(actual.Button, props);
    },
  };
}
