import { describe, expect, it, vi } from "vitest";
import { PricingComparison } from "@/features/billing/components/pricing-comparison";
import { PricingPlans } from "@/features/billing/components/pricing-plans";
import { PLANS } from "@/features/billing/plans";
import { PlanLock } from "@/shared/components/data/plan-lock";
import { attribute, classesOf, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The buttons call the server to open a payment: nothing here reaches it.
vi.mock("@/features/billing/actions", () => ({ startCheckoutAction: vi.fn(), continueOnFreeAction: vi.fn() }));
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");

  return {
    Link: ({ href, ...props }: React.ComponentProps<"a">) => createElement("a", { href, ...props }),
    useRouter: () => ({ push: () => {}, refresh: () => {} }),
  };
});

const visitor = { free: { kind: "free-signup" }, pro: { kind: "signup" }, enterprise: { kind: "signup" } } as const;
const base = { plans: PLANS, currency: "usd", taxExcluded: false, yearlySavings: 17 };

describe("the plans a visitor sees", () => {
  it("write each plan from PLANS, in dollars by default, with the trial of the recommended one", () => {
    const html = renderWithIntl(<PricingPlans {...base} ctas={visitor} />);

    expect(elements(html, "h3").map(textOf)).toEqual(["Free", "Pro", "Enterprise"]);
    expect(textOf(html)).toContain("$0");
    expect(textOf(html)).toContain("$29");
    expect(textOf(html)).toContain("$99");
    expect(textOf(html)).toContain("14-day free trial");
    expect(textOf(html)).toContain("Save 17%");
  });

  it("announce a trial only to who can still have it: no line, and the plain button, when the owner spent theirs", () => {
    const html = renderWithIntl(<PricingPlans {...base} trialPlanIds={[]} ctas={{ free: { kind: "free-signup" }, pro: { kind: "checkout", orgId: "o" }, enterprise: { kind: "checkout", orgId: "o" } }} />);

    expect(textOf(html)).not.toContain("14-day free trial");
    expect(elements(html, "button").map(textOf)).toContain("Choose Pro");
    expect(elements(html, "button").map(textOf)).not.toContain("Start free trial");
  });

  it("write the amounts in the currency and the language of the page: no sign of its own in a component", () => {
    const euro = renderWithIntl(<PricingPlans {...base} currency="eur" ctas={visitor} />, "fr");

    expect(textOf(euro).replaceAll(/\s/g, " ")).toContain("29 €");
    expect(textOf(euro)).not.toContain("$");
    expect(textOf(euro)).toContain("Économisez 17 %");
  });

  it("recommend one plan with a ring, not a wash, and one primary button for the row", () => {
    const html = renderWithIntl(<PricingPlans {...base} ctas={visitor} />);
    const cards = startTags(html, "div").filter((tag) => attribute(tag, "data-slot") === "plan-card");

    expect(cards.filter((tag) => attribute(tag, "data-recommended") !== undefined)).toHaveLength(1);
    expect(classesOf(cards.find((tag) => attribute(tag, "data-recommended") !== undefined) ?? "")).toEqual(expect.arrayContaining(["border-primary", "ring-1"]));
    const buttons = startTags(html, "a").filter((tag) => attribute(tag, "data-slot") === "button");
    expect(buttons.filter((tag) => classesOf(tag).includes("bg-primary"))).toHaveLength(1);
  });

  it("lead a visitor to sign-up with the plan and the period kept", () => {
    const html = renderWithIntl(<PricingPlans {...base} ctas={visitor} />);

    expect(startTags(html, "a").map((tag) => attribute(tag, "href"))).toEqual(["/sign-up", "/sign-up?plan=pro&amp;interval=monthly", "/sign-up?plan=enterprise&amp;interval=monthly"]);
  });

  it("have no button on the plans of a member, and say which plan is the workspace's", () => {
    const html = renderWithIntl(<PricingPlans {...base} ctas={{ free: { kind: "current", href: null }, pro: { kind: "none" }, enterprise: { kind: "none" } }} />);

    expect(elements(html, "button").map(textOf).filter((label) => label !== "Monthly" && !label.startsWith("Yearly"))).toEqual(["Your plan"]);
    expect(startTags(html, "a")).toEqual([]);
  });

  it("list what each plan includes, with its limits written in words and the unlimited said", () => {
    const text = textOf(renderWithIntl(<PricingPlans {...base} ctas={visitor} />));

    expect(text).toContain("1 team member");
    expect(text).toContain("3 projects");
    expect(text).toContain("100 MB of storage");
    expect(text).toContain("Unlimited team members");
    expect(text).toContain("Unlimited AI credits");
  });
});

describe("the comparison of the plans", () => {
  it("is a table with a column per plan and a row per limit and feature, read by its headers", () => {
    const html = renderWithIntl(<PricingComparison plans={PLANS} />);

    const headers = startTags(html, "th");
    expect(headers.every((tag) => ["col", "row"].includes(attribute(tag, "scope") ?? ""))).toBe(true);
    expect(headers.filter((tag) => attribute(tag, "scope") === "col")).toHaveLength(4);
    expect(textOf(html)).toContain("Compare the plans");
    // A cell with no figure says it in words only a screen reader reads
    expect(html).toContain("Not included");
    expect(html).toContain("Unlimited");
  });

  it("scrolls inside its own box, which the keyboard reaches", () => {
    const html = renderWithIntl(<PricingComparison plans={PLANS} />);
    const [region] = startTags(html, "div").filter((tag) => attribute(tag, "role") === "region");

    expect(attribute(region ?? "", "tabindex")).toBe("0");
    expect(attribute(region ?? "", "aria-labelledby")).toBe("comparison-title");
  });
});

describe("the lock of a feature the plan does not include", () => {
  it("names the plan that includes it, and leads to the plans", () => {
    const html = renderWithIntl(<PlanLock variant="card" feature="More projects" planName="Pro" href="/settings/billing" />);

    expect(textOf(html)).toContain("Included in the Pro plan");
    expect(attribute(startTags(html, "a")[0] ?? "", "href")).toBe("/settings/billing");
  });

  it("tells a role that cannot buy to ask, with no link to a page that would send it away", () => {
    const html = renderWithIntl(<PlanLock variant="line" feature="More projects" planName="Pro" href={null} />);

    expect(textOf(html)).toContain("Ask an owner or an admin");
    expect(startTags(html, "a")).toEqual([]);
  });

  it("holds the heading of a page when it replaces one", () => {
    const html = renderWithIntl(<PlanLock variant="page" headingLevel={1} feature="The API" planName="Pro" href="/settings/billing" />);

    expect(elements(html, "h1").map(textOf)).toEqual(["The API"]);
  });
});
