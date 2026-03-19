import { describe, expect, it } from "vitest";
import {
  capitalize,
  cn,
  formatCurrency,
  generateId,
  getInitials,
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
  });
});
