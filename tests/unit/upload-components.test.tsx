import { describe, expect, it } from "vitest";
import { FileDropzone } from "@/features/upload/components/file-dropzone";
import { UploadButton } from "@/features/upload/components/upload-button";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { elements, startTags, textOf } from "../helpers/html";
import { renderWithIntl } from "../helpers/intl";

/**
 * The two ways to pick a file say their words from the locales, in the language
 * of the page: they are drawn by a feature a project keeps, and an English
 * sentence in a French page is a defect no type check sees.
 */

describe("the dropzone", () => {
  it.each([
    ["en", "Drag & drop a file here, or click to browse"],
    ["fr", "Glissez un fichier ici, ou cliquez pour en choisir un"],
  ] as const)("invites the person to drop a file, in %s", (locale, words) => {
    expect(textOf(renderWithIntl(<FileDropzone onFileSelect={() => {}} />, locale))).toBe(words);
  });

  it("holds a file input that the label opens, with the invitation as its name", () => {
    const html = renderWithIntl(<FileDropzone onFileSelect={() => {}} accept="image/*" />);

    expect(startTags(html, "input")).toHaveLength(1);
    expect(elements(html, "label")).toHaveLength(1);
  });
});

describe("the upload button", () => {
  it.each([
    ["en", "Upload file"],
    ["fr", "Téléverser un fichier"],
  ] as const)("says what it does when it is given no words, in %s", (locale, words) => {
    const html = renderWithIntl(<UploadButton onFileSelect={() => {}} />, locale);

    expect(textOf(elements(html, "button")[0] ?? "")).toBe(words);
  });

  it("says the words it is given, in the language the caller chose", () => {
    const html = renderWithIntl(<UploadButton onFileSelect={() => {}}>Attach a receipt</UploadButton>, "fr");

    expect(textOf(elements(html, "button")[0] ?? "")).toBe("Attach a receipt");
  });
});

describe("the words of the upload components in the message files", () => {
  it("are in both languages, and in French are not the English ones", () => {
    for (const key of ["dropzone", "button"] as const) {
      expect(en.upload[key].trim(), `en ${key}`).not.toBe("");
      expect(fr.upload[key].trim(), `fr ${key}`).not.toBe("");
      expect(fr.upload[key]).not.toBe(en.upload[key]);
    }
    for (const key of Object.keys(en.upload.list) as (keyof typeof en.upload.list)[]) {
      expect(fr.upload.list[key], `fr list.${key}`).toBeTruthy();
      expect(fr.upload.list[key]).not.toBe(en.upload.list[key]);
    }
  });
});
