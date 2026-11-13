import { join } from "node:path";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SectionBoundary,
  SectionFallback,
} from "@/features/dashboard/components/section-boundary";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { buttonProps, forgetButtons } from "../../helpers/button-spy";
import { attribute, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";
import { inRepo, SRC } from "../../helpers/routes";
import { reportsItsError, sourceOf } from "../../helpers/source";

// The click of a button cannot be made in static markup, so the handler is read
// where it is handed over (tests/helpers/button-spy.ts).
vi.mock("@/shared/components/ui/button", async (importOriginal) => {
  const { spyOnButton } = await import("../../helpers/button-spy");
  return spyOnButton(
    await importOriginal<typeof import("@/shared/components/ui/button")>(),
  );
});

beforeEach(forgetButtons);

/** What the boundary draws in place of a section that threw, given what `catchError` hands its fallback. */
function fallback(error: unknown, retry: () => void, locale: "en" | "fr" = "en") {
  const Probe = () => SectionFallback({}, { error, retry, reset: () => {} });

  return renderWithIntl(createElement(Probe), locale);
}

describe("the boundary of a home section", () => {
  it("draws what is inside it, and nothing of its own, while nothing throws", () => {
    const html = renderWithIntl(
      <SectionBoundary>
        <p>Recent projects</p>
      </SectionBoundary>,
    );

    expect(html).toBe("<p>Recent projects</p>");
  });

  it("takes the place of the section with an alert, under a level-two heading: the h1 is the header's", () => {
    const html = fallback(new Error("boom"), () => {});

    expect(startTags(html, "h2")).toHaveLength(1);
    expect(startTags(html, "h1")).toHaveLength(0);
    expect(textOf(elements(html, "h2")[0])).toBe(en.common.errorTitle);
    expect(html).toContain('role="alert"');
  });

  it("says it in the language of the page, with a retry button", () => {
    const html = fallback(new Error("boom"), () => {}, "fr");

    expect(textOf(elements(html, "h2")[0])).toBe(fr.common.errorTitle);
    expect(textOf(elements(html, "button")[0])).toBe(fr.common.retry);
  });

  it("hands the retry of the boundary to its button, which calls it without the click event", () => {
    const retry = vi.fn();
    fallback(new Error("boom"), retry);

    buttonProps[0].onClick?.({} as never);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledWith();
  });

  it("shows nothing of what the error says", () => {
    const html = fallback(new Error("connect ECONNREFUSED db:5432"), () => {});

    expect(textOf(html)).not.toContain("ECONNREFUSED");
    expect(attribute(startTags(html, "button")[0], "type")).toBe("button");
  });

  // An effect does not run in static markup, so the call is read where it is written
  it("reports the error to the browser, through the shared hook", () => {
    const file = join(SRC, "features/dashboard/components/section-boundary.tsx");
    const source = sourceOf(file);

    expect(source, `${inRepo(file)} is not a client file`).toContain('"use client"');
    expect(reportsItsError(source), `${inRepo(file)} does not call useReportError(error)`).toBe(true);
  });
});
