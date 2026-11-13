import { describe, expect, it } from "vitest";
import { PasswordStrength } from "@/features/auth/components/password-strength";
import { attribute, classesOf, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The strength of a new password, told as it is typed: five bars and the five
// rules, one bar for each rule that passes. A rule is told by an icon (a check
// when it passes, a cross when it does not) and by words that only assistive
// technology reads ("met", "not met"): never by color alone. It draws in the
// tones of the theme, so that the dark theme and a rebrand reach it, and so that
// what it says is readable: the green of a rule that passes is the text tone of
// success, not a step of the palette that fails 4.5:1 on a card.

const RAW_PALETTE = /\b(?:bg|text)-(?:white|black|(?:orange|yellow|emerald|red|green|amber)-\d{2,3})\b/;

/** The classes of the bars (the boxes 4 px high) and the rules (the list items, with the icon they draw and the words only a screen reader hears). */
function partsOf(password: string, locale: "en" | "fr" = "en") {
  const html = renderWithIntl(<PasswordStrength password={password} />, locale);

  return {
    html,
    bars: startTags(html, "div").map((tag) => classesOf(tag)).filter((classes) => classes.includes("h-1")),
    rules: elements(html, "li").map((item) => {
      const hidden = elements(item, "span").find((span) => classesOf(startTags(span, "span")[0] ?? "").includes("sr-only"));
      const icon = startTags(item, "svg")[0] ?? "";

      return {
        text: textOf(item),
        classes: classesOf(startTags(item, "li")[0] ?? ""),
        icon: classesOf(icon),
        iconHidden: attribute(icon, "aria-hidden"),
        // What only a screen reader says, and what the eye reads of the rule
        hidden: hidden ? textOf(hidden) : undefined,
        visible: textOf(item.replace(hidden ?? "", "")),
      };
    }),
  };
}

describe("the strength of a password", () => {
  it("says nothing for an empty field", () => {
    expect(renderWithIntl(<PasswordStrength password="" />)).toBe("");
  });

  it("draws five bars and five rules, a check for the rules that pass and a cross for the others", () => {
    const { bars, rules } = partsOf("abc");

    expect(bars).toHaveLength(5);
    expect(rules).toHaveLength(5);
    // Lowercase passes; the length, the capital, the number and the symbol do not
    expect(rules.filter(({ icon }) => icon.includes("lucide-check"))).toHaveLength(1);
    expect(rules.filter(({ icon }) => icon.includes("lucide-x"))).toHaveLength(4);
    // No dot and no tick drawn as text any more: the icons are the marks
    for (const { text } of rules) {
      expect(text).not.toMatch(/[✓•]/);
    }
  });

  it("fills as many bars as rules pass, in the tone of how strong it is", () => {
    const filled = (password: string) => partsOf(password).bars.filter((classes) => !classes.includes("bg-track"));

    expect(filled("abc")).toHaveLength(1);
    expect(filled("abc")[0]).toContain("bg-destructive");
    expect(filled("Abcdefg1")[0]).toContain("bg-warning-bar");
    expect(filled("Abcdefg1!")[0]).toContain("bg-success");
    expect(filled("Abcdefg1!")).toHaveLength(5);
  });

  it("draws the bars that are not filled on the track, never on the hairline of the page", () => {
    const empty = partsOf("abc").bars.filter((classes) => classes.includes("bg-track"));

    expect(empty).toHaveLength(4);
    for (const classes of empty) {
      expect(classes).not.toContain("bg-muted");
    }
  });

  it("tells a rule that passes in the text tone of success, and one that does not in the muted ink", () => {
    const { rules } = partsOf("abc");
    const passed = rules.find(({ icon }) => icon.includes("lucide-check"));
    const waiting = rules.find(({ icon }) => icon.includes("lucide-x"));

    expect(passed?.classes).toContain("text-success-text");
    expect(waiting?.classes).toContain("text-ink-muted");
  });

  it("tells each password rule by icon and words, not by color alone", () => {
    const { rules } = partsOf("abc");

    expect(rules).toHaveLength(5);
    for (const rule of rules) {
      // An icon that is a picture to assistive technology, and words it can read
      expect(rule.iconHidden).toBe("true");
      expect(["met", "not met"]).toContain(rule.hidden);
      // The two agree: a check says "met", a cross says "not met"
      expect(rule.hidden).toBe(rule.icon.includes("lucide-check") ? "met" : "not met");
    }
    expect(rules.filter(({ hidden }) => hidden === "met")).toHaveLength(1);
    expect(rules.filter(({ hidden }) => hidden === "not met")).toHaveLength(4);
  });

  it("hides the words from the eye: they are for assistive technology, and the rule is what is seen", () => {
    const { html, rules } = partsOf("abc");

    expect(rules.map(({ visible }) => visible)).toEqual([
      "At least 8 characters",
      "One uppercase letter",
      "One lowercase letter",
      "One number",
      "One special character",
    ]);
    // `sr-only` is what keeps them out of sight: a missing class would print "not met" five times
    expect(startTags(html, "span").filter((tag) => classesOf(tag).includes("sr-only"))).toHaveLength(5);
  });

  it("says the same in French: the rule, then « respecté » or « non respecté »", () => {
    const { rules } = partsOf("abc", "fr");

    expect(rules.map(({ hidden }) => hidden)).toEqual([
      "non respecté",
      "non respecté",
      "respecté",
      "non respecté",
      "non respecté",
    ]);
    expect(rules[0]?.visible).toBe("Au moins 8 caractères");
  });

  it("says every rule met for a password that passes them all", () => {
    const { rules } = partsOf("Abcdefg1!");

    expect(rules.map(({ hidden }) => hidden)).toEqual(["met", "met", "met", "met", "met"]);
    expect(rules.every(({ icon }) => icon.includes("lucide-check"))).toBe(true);
  });

  it("takes the id it is given for its list, so that a field can name the rules that describe it", () => {
    const html = renderWithIntl(<PasswordStrength password="abc" id="rules-of-the-field" />);

    expect(attribute(startTags(html, "ul")[0] ?? "", "id")).toBe("rules-of-the-field");
  });

  it("gives its list no id when it is given none", () => {
    expect(attribute(startTags(partsOf("abc").html, "ul")[0] ?? "", "id")).toBeUndefined();
  });

  it("leaves the bars to the eye: the list says the same in words", () => {
    const { html } = partsOf("abc");
    const wrapper = startTags(html, "div").find((tag) => classesOf(tag).includes("flex") && classesOf(tag).includes("gap-1")) ?? "";

    expect(attribute(wrapper, "aria-hidden")).toBe("true");
  });

  it("takes no color from the palette of the framework, for any password", () => {
    for (const password of ["a", "abc", "Abcdefg", "Abcdefg1", "Abcdefg1!"]) {
      expect(partsOf(password).html, password).not.toMatch(RAW_PALETTE);
    }
  });
});
