import { describe, expect, it } from "vitest";
import DashboardLoading from "@/app/[locale]/(app)/(shell)/dashboard/loading";
import en from "@/locales/en.json";
import { classesOf, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

/**
 * The loading state of the home draws what the home draws, to the size of it: a
 * header, the quotas as the cards of a quota, and a card of rows. The page
 * moves when it arrives by as much as the two differ, so the quotas, which are
 * the tallest part of the first screen, must not be drawn as stat cards.
 */

const html = renderWithIntl(<DashboardLoading />);
const cards = startTags(html, "div").filter((tag) => /data-slot="card"/.test(tag));

describe("the loading state of the home", () => {
  it("draws the four quotas as quota cards, which fill their cell as the real ones do", () => {
    const quotaCards = cards.filter((tag) => classesOf(tag).includes("h-full"));

    expect(quotaCards).toHaveLength(4);
  });

  it("puts them on the columns of the page: one, two from sm, four from xl", () => {
    const row = startTags(html, "div").find((tag) => /data-slot="cards-row-skeleton"/.test(tag)) ?? "";

    expect(classesOf(row)).toEqual(
      expect.arrayContaining(["grid-cols-1", "sm:grid-cols-2", "xl:grid-cols-4"]),
    );
  });

  it("ends with one card of rows, the other blocks of the page", () => {
    expect(cards).toHaveLength(4 + 1);
  });

  it("says it is loading once, as one busy region", () => {
    expect(textOf(html)).toBe(en.common.loading);
    expect(startTags(html, "div").filter((tag) => /data-slot="loading-region"/.test(tag))).toHaveLength(1);
  });
});
