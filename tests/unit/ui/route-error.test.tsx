import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { RouteError } from "@/shared/components/data/route-error";
import { buttonProps, forgetButtons } from "../../helpers/button-spy";
import { attribute, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The click of a button cannot be made in static markup, so the handler is read
// where it is handed over (tests/helpers/button-spy.ts).
vi.mock("@/shared/components/ui/button", async (importOriginal) => {
  const { spyOnButton } = await import("../../helpers/button-spy");
  return spyOnButton(
    await importOriginal<typeof import("@/shared/components/ui/button")>(),
  );
});

beforeEach(forgetButtons);

const retry = () => {};

/** The start tag of the error state, whatever the route draws around it. */
function stateTag(html: string): string {
  return /<[a-z0-9][^>]*\sdata-slot="error-state"[^>]*>/.exec(html)?.[0] ?? "";
}

describe("route error", () => {
  it("shows a level-one heading and a retry button", () => {
    const html = renderWithIntl(
      <RouteError error={new Error("boom")} retry={retry} />,
    );

    expect(startTags(html, "h1")).toHaveLength(1);
    expect(textOf(elements(html, "h1")[0])).toBe(en.common.errorTitle);
    for (const level of [2, 3]) {
      expect(startTags(html, `h${level}`)).toHaveLength(0);
    }
    expect(startTags(html, "button")).toHaveLength(1);
    expect(textOf(elements(html, "button")[0])).toBe(en.common.retry);
  });

  it("says it in the language of the page", () => {
    const html = renderWithIntl(
      <RouteError error={new Error("boom")} retry={retry} />,
      "fr",
    );

    expect(textOf(elements(html, "h1")[0])).toBe(fr.common.errorTitle);
    expect(textOf(elements(html, "button")[0])).toBe(fr.common.retry);
  });

  it("is an alert, so that assistive technology says it as it appears", () => {
    const html = renderWithIntl(
      <RouteError error={new Error("boom")} retry={retry} />,
    );

    expect(attribute(stateTag(html), "role")).toBe("alert");
  });

  it("hands the retry of the route to its button, which calls it without the click event", () => {
    const spy = vi.fn();
    renderWithIntl(<RouteError error={new Error("boom")} retry={spy} />);
    const [button] = buttonProps;

    button.onClick?.({} as never);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith();
  });

  // In development the message of a Server Component's error reaches the page,
  // and it may hold a query or an address: the state says nothing of it.
  it("shows nothing of what the error says", () => {
    const html = renderWithIntl(
      <RouteError
        error={new Error("connect ECONNREFUSED postgres://admin@db:5432")}
        retry={retry}
      />,
    );

    expect(textOf(html)).not.toContain("ECONNREFUSED");
    expect(textOf(html)).not.toContain("postgres");
  });

  it("takes an error that is not an Error", () => {
    expect(() =>
      renderWithIntl(<RouteError error="a string was thrown" retry={retry} />),
    ).not.toThrow();
  });

  // The focus goes there by script when the page lost it: a heading is not a
  // control, so it is never a tab stop.
  it("makes the title a place the focus can be sent to, and never a tab stop", () => {
    const html = renderWithIntl(
      <RouteError error={new Error("boom")} retry={retry} />,
    );

    expect(attribute(startTags(html, "h1")[0], "tabindex")).toBe("-1");
  });
});
