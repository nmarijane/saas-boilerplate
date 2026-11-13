import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminWaitlistPage, {
  generateMetadata as waitlistMetadata,
} from "@/app/[locale]/(app)/(shell)/admin/waitlist/page";
import { appPageMetadata } from "@/features/app-shell";
import { WAITLIST_PAGE_SIZE } from "@/features/waitlist/queries";
import { waitlistEntry } from "@/models";
import {
  clearPeople,
  contextOf,
  describeAdminPage,
  draw,
  headings,
  intl,
  MINUTE,
  params,
  resetAdminPage,
  rows,
  rowsOf,
} from "../helpers/admin-pages";
import { attribute, decodedClassesOf, elements, startTags, textOf } from "../helpers/html";
import { testDb } from "../setup";

// The waiting list page, with the real guards, against the in-memory database.
// What the admin pages share is in tests/helpers/admin-pages.tsx.

vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
vi.mock("@/features/auth/auth", async () => (await import("../helpers/admin-pages")).authMock());
vi.mock("@/features/app-shell", async () => (await import("../helpers/admin-pages")).appShellMock());
vi.mock("next-intl/server", async () => (await import("../helpers/admin-pages")).intlServerMock());
vi.mock("@/shared/lib/i18n-navigation", async () => (await import("../helpers/admin-pages")).navigationMock());

const waitlistProps = (locale: "en" | "fr" = "en", page?: string) => ({
  ...params(locale),
  searchParams: Promise.resolve(page === undefined ? {} : { page }),
});

async function seedWaitlist(count: number, invited = 0) {
  const now = Date.now();
  await testDb.insert(waitlistEntry).values(
    rows(count, (index) => ({
      id: `signup-${index}`,
      email: `signup-${index}@example.com`,
      referralCode: `code${index}`,
      referralCount: count - index,
      status: index < invited ? "invited" : "waiting",
      // Newest first is how the page lists them: signup 0 is the latest
      createdAt: new Date(now - index * MINUTE),
    })),
  );
}

beforeEach(async () => {
  vi.mocked(appPageMetadata).mockClear();
  resetAdminPage();
  await testDb.delete(waitlistEntry);
  await clearPeople();
});

describeAdminPage({
  name: "waitlist",
  draw: (locale) => AdminWaitlistPage(waitlistProps(locale)),
  metadata: (locale) => waitlistMetadata(waitlistProps(locale)),
  title: { en: "Waitlist", fr: "Liste d'attente" },
  appPageMetadata,
});

describe("the waitlist page", () => {
  it("counts the signups in its header: the total of its stats, past the 20 its table shows", async () => {
    await seedWaitlist(25, 3);
    const html = await draw(AdminWaitlistPage(waitlistProps()));

    expect(contextOf(html)).toBe("25 signups");
    expect(rowsOf(html)).toHaveLength(20);
  });

  it("says one signup in the singular, and counts in French", async () => {
    await seedWaitlist(1);
    expect(contextOf(await draw(AdminWaitlistPage(waitlistProps())))).toBe("1 signup");

    intl.locale = "fr";
    expect(contextOf(await draw(AdminWaitlistPage(waitlistProps("fr")), "fr"))).toBe("1 inscrit");
  });

  it("says the figures of the list once: the total is the header's, the cards give the rest", async () => {
    await seedWaitlist(25, 3);
    const html = await draw(AdminWaitlistPage(waitlistProps()));
    const text = textOf(html);

    expect(text).toContain("Invited3");
    expect(text).toContain("Waiting22");
    // No third card repeating the total, and no count in the title of the card of the entries
    expect(text).not.toContain("Total");
    expect(headings(html).h2).toContain("Signups");
    expect(headings(html).h2.join(" ")).not.toMatch(/\d/);
  });

  // The figures of the cards go through the formatter of the page, as the other admin figures do
  it("groups the thousands of the figures of its cards the way the language of the page does", async () => {
    await seedWaitlist(2500, 1200);
    const english = textOf(await draw(AdminWaitlistPage(waitlistProps())));
    intl.locale = "fr";
    // The thousands are separated by spaces that do not break: read as spaces
    const french = textOf(await draw(AdminWaitlistPage(waitlistProps("fr")), "fr")).replaceAll(/\s/g, " ");

    expect(english).toContain("Invited1,200");
    expect(english).toContain("Waiting1,300");
    expect(french).toContain("Invités1 200");
    expect(french).toContain("En attente1 300");
  });

  it("names the people who referred the most, in the order of their referrals", async () => {
    await seedWaitlist(3);
    const html = await draw(AdminWaitlistPage(waitlistProps()));
    const [list = ""] = elements(html, "ol");

    expect(headings(html).h2).toEqual(["Top referrers", "Signups"]);
    expect(elements(list, "li").map(textOf)).toEqual([
      expect.stringContaining("signup-0@example.com"),
      expect.stringContaining("signup-1@example.com"),
      expect.stringContaining("signup-2@example.com"),
    ]);
    expect(textOf(list)).toContain("3 referrals");
    expect(textOf(list)).toContain("1 referral");
    expect(textOf(list)).not.toContain("1 referrals");
  });

  // Nothing in the box of the table takes the focus once everyone is invited: it is named by the
  // title of its card, and a tab reaches it (the axe rule scrollable-region-focusable, at 390 px).
  it("names the box of the table by the title of its card, a region the keyboard reaches", async () => {
    await seedWaitlist(4, 4);
    const html = await draw(AdminWaitlistPage(waitlistProps()));
    const title = elements(html, "h2").find((heading) => textOf(heading) === "Signups") ?? "";
    const titleId = /\sid="([^"]+)"/.exec(startTags(title, "h2")[0] ?? "")?.[1];
    const [box = ""] = startTags(html, "div").filter((tag) => tag.includes('data-slot="table-container"'));

    expect(titleId).toBeTruthy();
    expect(/\saria-labelledby="([^"]+)"/.exec(box)?.[1]).toBe(titleId);
    expect(/\srole="([^"]+)"/.exec(box)?.[1]).toBe("region");
    expect(/\stabindex="([^"]+)"/.exec(box)?.[1]).toBe("0");
  });

  it("leaves the card of the referrers out while there is no one to name", async () => {
    const html = await draw(AdminWaitlistPage(waitlistProps()));

    expect(headings(html).h2).toEqual(["Signups"]);
    expect(textOf(html)).toContain("No waitlist entries yet.");
  });

  it("reads its page from the address, and falls back to the first when the address does not say a page", async () => {
    await seedWaitlist(25);
    const second = await draw(AdminWaitlistPage(waitlistProps("en", "2")));

    expect(rowsOf(second)).toHaveLength(5);
    expect(textOf(second)).toContain("Page 2 of 2");

    // A page that cannot be read used to be swallowed into an empty page by the
    // catch: with no catch it must not reach the database as NaN.
    for (const garbage of ["abc", "", "-3", "0", "1.5e3", "NaN", "99999999999999999999"]) {
      const first = await draw(AdminWaitlistPage(waitlistProps("en", garbage)));

      expect(rowsOf(first), `?page=${garbage}`).toHaveLength(20);
    }
  });

  it("gives the first page no line of its own while the list fits on one", async () => {
    await seedWaitlist(5);

    expect(textOf(await draw(AdminWaitlistPage(waitlistProps())))).not.toContain("Page 1 of");
  });

  it("offers an invitation to those who wait, and to no one else", async () => {
    await seedWaitlist(4, 2);
    const html = await draw(AdminWaitlistPage(waitlistProps()));

    // Two of the four are invited already
    expect(elements(html, "button").map(textOf)).toEqual(["Invite", "Invite"]);
  });
});

// The list is pages of 20: the card links the one before and the one after, and a page past the end is the last.
describe("the waitlist page, over several pages", () => {
  /** The links of the footer of the card: the text they say, and where they lead. */
  function pagerOf(html: string) {
    return elements(html, "a")
      .filter((link) => /Previous page|Next page|Page précédente|Page suivante/.test(textOf(link)))
      .map((link) => ({ text: textOf(link), href: attribute(startTags(link, "a")[0] ?? "", "href"), tag: startTags(link, "a")[0] ?? "" }));
  }

  it("links the next page from the first, and no page before it", async () => {
    await seedWaitlist(25);
    const html = await draw(AdminWaitlistPage(waitlistProps()));

    expect(textOf(html)).toContain("Page 1 of 2");
    expect(pagerOf(html).map(({ text, href }) => [text, href])).toEqual([["Next page", "/admin/waitlist?page=2"]]);
  });

  it("links the page before from the last, and no page after it", async () => {
    await seedWaitlist(25);
    const html = await draw(AdminWaitlistPage(waitlistProps("en", "2")));

    expect(textOf(html)).toContain("Page 2 of 2");
    // The first page is the address with no page in it
    expect(pagerOf(html).map(({ text, href }) => [text, href])).toEqual([["Previous page", "/admin/waitlist"]]);
  });

  it("links both from a page in the middle", async () => {
    await seedWaitlist(WAITLIST_PAGE_SIZE * 3 - 5);
    const html = await draw(AdminWaitlistPage(waitlistProps("en", "2")));

    expect(textOf(html)).toContain("Page 2 of 3");
    expect(pagerOf(html).map(({ text, href }) => [text, href])).toEqual([
      ["Previous page", "/admin/waitlist"],
      ["Next page", "/admin/waitlist?page=3"],
    ]);
    const third = await draw(AdminWaitlistPage(waitlistProps("en", "3")));

    expect(pagerOf(third).map(({ text, href }) => [text, href])).toEqual([["Previous page", "/admin/waitlist?page=2"]]);
  });

  it("makes each link a 44 px target, as a button of the family", async () => {
    await seedWaitlist(WAITLIST_PAGE_SIZE * 3 - 5);
    const html = await draw(AdminWaitlistPage(waitlistProps("en", "2")));

    // Both are there, or the loop below checks nothing
    expect(pagerOf(html)).toHaveLength(2);
    for (const { tag } of pagerOf(html)) {
      expect(decodedClassesOf(tag)).toEqual(expect.arrayContaining(["tap-target", "h-9", "border"]));
    }
  });

  it("links nothing while the list fits on one page", async () => {
    await seedWaitlist(WAITLIST_PAGE_SIZE);
    const html = await draw(AdminWaitlistPage(waitlistProps()));

    expect(pagerOf(html)).toEqual([]);
    expect(textOf(html)).not.toContain("Page 1 of");
  });

  it("speaks French in its links and its line", async () => {
    intl.locale = "fr";
    await seedWaitlist(WAITLIST_PAGE_SIZE * 3 - 5);
    const html = await draw(AdminWaitlistPage(waitlistProps("fr", "2")), "fr");

    expect(textOf(html)).toContain("Page 2 sur 3");
    expect(pagerOf(html).map(({ text }) => text)).toEqual(["Page précédente", "Page suivante"]);
  });

  it("draws the entries of the page it is on", async () => {
    await seedWaitlist(25);
    const html = await draw(AdminWaitlistPage(waitlistProps("en", "2")));

    expect(rowsOf(html)).toHaveLength(5);
    expect(textOf(html)).toContain("signup-20@example.com");
    expect(textOf(html)).not.toContain("signup-19@example.com");
  });

  // `?page=99` of a list of two pages is the second, not an empty page that says "Page 99 of 2" and that nothing is there
  it("shows the last page for a page past the last", async () => {
    await seedWaitlist(25);
    const html = await draw(AdminWaitlistPage(waitlistProps("en", "99")));

    expect(textOf(html)).toContain("Page 2 of 2");
    expect(textOf(html)).not.toContain("Page 99");
    expect(rowsOf(html)).toHaveLength(5);
    expect(pagerOf(html).map(({ text, href }) => [text, href])).toEqual([["Previous page", "/admin/waitlist"]]);
  });

  it("shows the first page of an empty list for any page", async () => {
    const html = await draw(AdminWaitlistPage(waitlistProps("en", "3")));

    expect(textOf(html)).toContain("No waitlist entries yet.");
    expect(pagerOf(html)).toEqual([]);
  });
});

describe("the waitlist page, its invitations", () => {
  // Each row has its own button: a screen reader tells them apart by the address
  it("names each invitation by the address it is for", async () => {
    await seedWaitlist(3);
    const html = await draw(AdminWaitlistPage(waitlistProps()));

    expect(
      startTags(html, "button").map((tag) => attribute(tag, "aria-label")),
    ).toEqual(["Invite signup-0@example.com", "Invite signup-1@example.com", "Invite signup-2@example.com"]);
  });

  it("names them in French", async () => {
    intl.locale = "fr";
    await seedWaitlist(1);
    const html = await draw(AdminWaitlistPage(waitlistProps("fr")), "fr");

    expect(startTags(html, "button").map((tag) => attribute(tag, "aria-label"))).toEqual(["Inviter signup-0@example.com"]);
  });
});
