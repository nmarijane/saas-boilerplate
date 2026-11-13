import { afterEach, describe, expect, it, vi } from "vitest";
import {
  capitalize,
  cn,
  editing,
  formatCurrency,
  generateId,
  getInitials,
  matchesSearch,
  notAfter,
  slugify,
} from "@/shared/utils/helpers";

describe("helpers", () => {
  describe("cn", () => {
    it("merges class names", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("handles conditional classes", () => {
      expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    });

    it("merges tailwind conflicts", () => {
      expect(cn("p-4", "p-2")).toBe("p-2");
    });
  });

  describe("generateId", () => {
    it("returns a valid UUID", () => {
      const id = generateId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("generates unique IDs", () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });
  });

  describe("slugify", () => {
    it("converts to lowercase", () => {
      expect(slugify("Hello World")).toBe("hello-world");
    });

    it("removes accents", () => {
      expect(slugify("cafe creme")).toBe("cafe-creme");
    });

    it("replaces special chars with hyphens", () => {
      expect(slugify("foo@bar!baz")).toBe("foo-bar-baz");
    });

    it("trims leading/trailing hyphens", () => {
      expect(slugify("--hello--")).toBe("hello");
    });
  });

  describe("formatCurrency", () => {
    it("formats USD cents to dollars", () => {
      expect(formatCurrency(1999)).toBe("$19.99");
    });

    it("formats zero", () => {
      expect(formatCurrency(0)).toBe("$0.00");
    });
  });

  describe("capitalize", () => {
    it("capitalizes first letter", () => {
      expect(capitalize("hello")).toBe("Hello");
    });

    it("handles empty string", () => {
      expect(capitalize("")).toBe("");
    });
  });

  describe("getInitials", () => {
    it("gets initials from full name", () => {
      expect(getInitials("John Doe")).toBe("JD");
    });

    it("handles single name", () => {
      expect(getInitials("John")).toBe("J");
    });

    it("limits to 2 characters", () => {
      expect(getInitials("John Michael Doe")).toBe("JM");
    });

    it("skips a word that holds no letter or digit, an emoji for one", () => {
      expect(getInitials("🚀 Launch")).toBe("L");
    });

    it("does not read a double space, or a space at the start, as a word", () => {
      expect(getInitials("Studio  Nord")).toBe("SN");
      expect(getInitials("  Studio Nord")).toBe("SN");
    });

    it("capitalizes an accented letter", () => {
      expect(getInitials("émilie durand")).toBe("ÉD");
    });

    it("is empty when no word holds a letter or a digit", () => {
      expect(getInitials("!!!")).toBe("");
      expect(getInitials("")).toBe("");
      expect(getInitials("   ")).toBe("");
    });

    it("capitalizes a single lowercase word", () => {
      expect(getInitials("acme")).toBe("A");
    });

    it("takes the first letter or digit of a word that starts with a mark", () => {
      expect(getInitials("(Acme) #42")).toBe("A4");
    });

    it("keeps a letter outside the first plane whole, never half of a surrogate pair", () => {
      const initials = getInitials("𝒜lpha Beta");

      expect([...initials]).toEqual(["𝒜", "B"]);
      expect(initials).toBe("𝒜B");
    });
  });

  // What the server and the browser each compute must be the same string: an
  // initial is drawn on the server and read again in the browser, and a locale
  // dependent case map (Turkish turns "i" into "İ") would make them differ and
  // break hydration. The runtime here is not Turkish, so the case maps that depend
  // on the locale are replaced by Turkish ones: what is built on them would show.
  describe("case maps", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("capitalizes initials the same wherever they are drawn, a Turkish runtime included", () => {
      vi.spyOn(String.prototype, "toLocaleUpperCase").mockImplementation(
        function (this: string) {
          return this.replaceAll("i", "İ").toUpperCase();
        },
      );

      expect(getInitials("istanbul izmir")).toBe("II");
    });

    it("folds a search the same wherever it is read, a Turkish runtime included", () => {
      vi.spyOn(String.prototype, "toLocaleLowerCase").mockImplementation(
        function (this: string) {
          return this.replaceAll("I", "ı").toLowerCase();
        },
      );

      expect(matchesSearch("Istanbul", "istanbul")).toBe(true);
      expect(matchesSearch("ISTANBUL", "istanbul")).toBe(true);
      expect(matchesSearch("istanbul", "ISTANBUL")).toBe(true);
    });

    it("still reads the dotted capital I as an i", () => {
      expect(matchesSearch("İstanbul", "istanbul")).toBe(true);
    });
  });

  // The home, the project cards and the notifications all tell how long ago
  // something happened. The clock that stamped it (a database, a browser) can
  // run ahead of the one that tells the time, and what has just happened must not
  // read "in an hour".
  describe("notAfter", () => {
    const NOW = new Date("2026-11-03T12:00:00.000Z");

    it("keeps a moment that has passed", () => {
      const past = new Date("2026-11-03T10:00:00.000Z");

      expect(notAfter(past, NOW)).toBe(past);
    });

    it("reads a moment to come as now", () => {
      const ahead = new Date("2026-11-03T13:00:00.000Z");

      expect(notAfter(ahead, NOW).getTime()).toBe(NOW.getTime());
    });

    it("keeps the very moment of now", () => {
      expect(notAfter(new Date(NOW), NOW).getTime()).toBe(NOW.getTime());
    });

    it("does not change what it was given", () => {
      const ahead = new Date("2026-11-03T13:00:00.000Z");

      notAfter(ahead, NOW);

      expect(ahead.toISOString()).toBe("2026-11-03T13:00:00.000Z");
      expect(NOW.toISOString()).toBe("2026-11-03T12:00:00.000Z");
    });
  });

  // The forms of the project, the profile and the password each have fields whose
  // typing is another try: the "Saved" status and the error of the last send go.
  describe("editing", () => {
    it("sets the value of the field, then forgets what the last send said", () => {
      const calls: string[] = [];
      const edit = editing<string>(
        (value) => calls.push(`set:${String(value)}`),
        () => calls.push("forget"),
      );

      edit("Atlas");

      expect(calls).toEqual(["set:Atlas", "forget"]);
    });

    it("forgets at every edit, not only the first: each keystroke is another try", () => {
      const set = vi.fn();
      const forget = vi.fn();
      const edit = editing<string>(set, forget);

      edit("A");
      edit("At");
      edit("");

      expect(set.mock.calls).toEqual([["A"], ["At"], [""]]);
      expect(forget).toHaveBeenCalledTimes(3);
    });

    it("hands the value over as it is, whatever it is: a status, an object, an empty text", () => {
      const set = vi.fn();
      const status = { id: "active" };

      editing<typeof status>(set, () => {})(status);
      editing<string | null>(set, () => {})(null);

      expect(set.mock.calls[0]?.[0]).toBe(status);
      expect(set.mock.calls[1]?.[0]).toBeNull();
    });

    it("does nothing until it is called: building the setter touches neither", () => {
      const set = vi.fn();
      const forget = vi.fn();

      editing<string>(set, forget);

      expect(set).not.toHaveBeenCalled();
      expect(forget).not.toHaveBeenCalled();
    });
  });

  describe("matchesSearch", () => {
    it("finds a text that holds what was typed, in any case", () => {
      expect(matchesSearch("Studio Nord", "nord")).toBe(true);
      expect(matchesSearch("Studio Nord", "STUDIO")).toBe(true);
    });

    it("ignores accents, in the text and in the search", () => {
      expect(matchesSearch("Atelier Été", "ete")).toBe(true);
      expect(matchesSearch("Atelier Ete", "ÉTÉ")).toBe(true);
    });

    it("matches everything when nothing was typed", () => {
      expect(matchesSearch("Studio Nord", "")).toBe(true);
      expect(matchesSearch("Studio Nord", "   ")).toBe(true);
    });

    it("does not match a text that lacks it", () => {
      expect(matchesSearch("Studio Nord", "sud")).toBe(false);
    });

    it("keeps the spaces inside what was typed", () => {
      expect(matchesSearch("Studio Nord", "o n")).toBe(true);
      expect(matchesSearch("Studio Nord", "o  n")).toBe(false);
    });
  });
});
