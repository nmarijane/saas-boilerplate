import { describe, expect, it, vi } from "vitest";
import { FileList } from "@/features/upload/components/file-list";
import { attribute, elements, startTags, textOf } from "../helpers/html";
import { renderWithIntl } from "../helpers/intl";

// The list calls the server action that deletes a file: it is replaced, nothing here reaches the database.
vi.mock("@/features/upload/actions", () => ({ deleteFile: vi.fn() }));

const DAY = new Date("2026-11-04T10:00:00Z");

const file = (id: string, size: number) => ({ id, filename: `${id}.pdf`, mimetype: "application/pdf", size, createdAt: DAY });

/** The size on the line under each name (the size, then the type). */
function sizesOf(html: string): string[] {
  return elements(html, "p")
    .map(textOf)
    .filter((line) => line.includes("application/pdf"))
    .map((line) => line.split(" · ")[0] ?? "");
}

// A megabyte is a million bytes, as the storage quota counts it: the same file reads the same figure in the list
// and in the card that says how much of the storage is used.
describe("the size of a file in the list", () => {
  const draw = (sizes: number[], locale: "en" | "fr" = "en") =>
    renderWithIntl(<FileList files={sizes.map((size, index) => file(`f${index}`, size))} />, locale);

  it("counts in kilobytes of a thousand and megabytes of a million", () => {
    expect(sizesOf(draw([512, 1_500, 999_000, 1_000_000, 10_400_000]))).toEqual(["512 bytes", "2 kB", "999 kB", "1 MB", "10.4 MB"]);
  });

  // The short form of a byte is "byte" in English, which reads wrong next to "2 kB": bytes are said in words, the other units are not
  it.each([
    ["en", [1, 2, 512, 999], ["1 byte", "2 bytes", "512 bytes", "999 bytes"]],
    ["fr", [1, 2, 512, 999], ["1\u00A0octet", "2\u00A0octets", "512\u00A0octets", "999\u00A0octets"]],
  ] as const)("says a size under a kilobyte in words, in the language of the page (%s)", (locale, sizes, told) => {
    expect(sizesOf(draw([...sizes], locale))).toEqual([...told]);
  });

  it("writes a size on one decimal: 1,048,576 bytes rounds to \"1 MB\", and 1,149,000 to \"1.1 MB\"", () => {
    expect(sizesOf(draw([1_048_576]))).toEqual(["1 MB"]);
    expect(sizesOf(draw([1_149_000]))).toEqual(["1.1 MB"]);
  });

  it("writes the figure and the unit as the language of the page does", () => {
    // French puts a narrow no-break space between the figure and the unit
    expect(sizesOf(draw([1_500, 10_400_000], "fr"))).toEqual(["2\u202Fko", "10,4\u202FMo"]);
  });

  it("says there is nothing yet when there is no file, in the language of the page", () => {
    expect(textOf(renderWithIntl(<FileList files={[]} />))).toBe("No files uploaded yet.");
    expect(textOf(renderWithIntl(<FileList files={[]} />, "fr"))).toBe("Aucun fichier téléversé pour l'instant.");
  });
});

// The words of the list are the locales', and every row has a link and a button that say the same word:
// each is named by its file, with the visible word inside the name
describe("the words of the file list", () => {
  const draw = (locale: "en" | "fr" = "en") =>
    renderWithIntl(<FileList files={[file("report", 2_000), file("logo", 3_000)]} />, locale);

  it.each([
    ["en", "View", "Delete", ["View report.pdf", "View logo.pdf"], ["Delete report.pdf", "Delete logo.pdf"]],
    ["fr", "Voir", "Supprimer", ["Voir report.pdf", "Voir logo.pdf"], ["Supprimer report.pdf", "Supprimer logo.pdf"]],
  ] as const)("says %s, and names each link and button by its file", (locale, view, remove, viewNames, deleteNames) => {
    const html = draw(locale);

    expect(startTags(html, "a").map((tag) => attribute(tag, "aria-label"))).toEqual([...viewNames]);
    expect(startTags(html, "button").map((tag) => attribute(tag, "aria-label"))).toEqual([...deleteNames]);
    expect(elements(html, "a").map(textOf)).toEqual([view, view]);
    expect(elements(html, "button").map(textOf)).toEqual([remove, remove]);
  });

  it("holds the visible word inside the accessible name of each control (WCAG 2.5.3)", () => {
    for (const locale of ["en", "fr"] as const) {
      const html = draw(locale);
      const controls = [...startTags(html, "a"), ...startTags(html, "button")];

      expect(controls).toHaveLength(4);
      for (const [index, tag] of controls.entries()) {
        const visible = textOf([...elements(html, "a"), ...elements(html, "button")][index] ?? "");
        expect(attribute(tag, "aria-label")).toContain(visible);
      }
    }
  });
});
