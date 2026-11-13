import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fileSizeOf } from "@/features/upload/file-size";
import { BYTES_PER_KILOBYTE, BYTES_PER_MEGABYTE } from "@/features/upload/units";
import { failureMessage, UploadFailed } from "@/features/upload/upload-failure";
import { validateFile } from "@/features/upload/validation";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";

/**
 * The upload counts in one unit: a megabyte is a million bytes, which is the unit
 * of the storage quota (the limits of the plans are written in it), and the limit
 * of a file, the size a list shows and the figure in a refusal all follow it. A
 * file of 10.4 million bytes must not be called "10 MB" by one and refused by
 * another.
 */

const ROOT = resolve(import.meta.dirname, "../..");

const file = (size: number, type = "application/pdf") => ({ size, type }) as File;

describe("the unit of the uploads", () => {
  it("is a megabyte of a million bytes, and a kilobyte of a thousand: the unit of the quota", () => {
    expect(BYTES_PER_MEGABYTE).toBe(1_000_000);
    expect(BYTES_PER_KILOBYTE).toBe(1_000);
    // The quota reads the same constant: the storage a workspace uses is told in it
    expect(readFileSync(join(ROOT, "src/features/upload/queries.ts"), "utf8")).toContain('from "./units"');
  });

  it("is not written again, in another unit, anywhere in the feature", () => {
    for (const path of ["queries.ts", "validation.ts", "file-size.ts", "components/file-list.tsx"]) {
      const source = readFileSync(join(ROOT, "src/features/upload", path), "utf8");

      expect(source, path).not.toMatch(/1_048_576|1048576|1024\s*\*\s*1024|\/\s*1024\b/);
    }
  });
});

describe("the size of a file in the list", () => {
  it.each([
    [0, 0, "byte"],
    [999, 999, "byte"],
    [1_000, 1, "kilobyte"],
    [1_499, 1, "kilobyte"],
    [1_500, 2, "kilobyte"],
    [999_499, 999, "kilobyte"],
    // 1 MiB is 1.05 million bytes: a megabyte and a twentieth, not a round megabyte
    [1_048_576, 1, "megabyte"],
    [1_000_000, 1, "megabyte"],
    [10_000_000, 10, "megabyte"],
    [10_400_000, 10.4, "megabyte"],
    [10_485_760, 10.5, "megabyte"],
  ] as const)("tells %i bytes as %d %s", (bytes, value, unit) => {
    expect(fileSizeOf(bytes)).toEqual({ value, unit });
  });

  it("goes to the next unit at a thousand of the one before, never at a power of two, and never says 1000 kilobytes", () => {
    expect(fileSizeOf(1_023)).toEqual({ value: 1, unit: "kilobyte" });
    expect(fileSizeOf(999_499)).toEqual({ value: 999, unit: "kilobyte" });
    expect(fileSizeOf(999_500)).toEqual({ value: 1, unit: "megabyte" });
    expect(fileSizeOf(999_999)).toEqual({ value: 1, unit: "megabyte" });
  });
});

describe("the limit of a file", () => {
  it("is 10 MB: ten million bytes, as the quota counts them", () => {
    expect(validateFile(file(10_000_000))).toEqual({ valid: true });
    expect(validateFile(file(10_000_001)).valid).toBe(false);
    // A file the list would call "10.4 MB" is too large for a limit of 10 MB
    expect(validateFile(file(10_400_000)).valid).toBe(false);
  });

  // The words are in the message files, in the language of the page that tells them: the validation says which refusal and with what
  it("refuses a file that is too large with the code that says why, and the figure its message takes", () => {
    expect(validateFile(file(12_345_678))).toEqual({
      valid: false,
      error: { code: "FILE_TOO_LARGE", values: { max: 10 } },
    });
  });

  it("refuses a type it does not take with the code that says why, and the type", () => {
    expect(validateFile(file(1_000, "application/x-msdownload"))).toEqual({
      valid: false,
      error: { code: "FILE_TYPE_NOT_ALLOWED", values: { type: "application/x-msdownload" } },
    });
  });

  it("names a file that has no type: the browser gives none for what it does not know", () => {
    expect(validateFile(file(1_000, ""))).toMatchObject({ error: { code: "FILE_TYPE_NOT_ALLOWED", values: { type: "unknown" } } });
  });

  it("writes no sentence of its own: not in English, not in any language", () => {
    expect(readFileSync(join(ROOT, "src/features/upload/validation.ts"), "utf8")).not.toMatch(/File too large|is not allowed|Maximum size/);
  });
});

describe("the messages of a refused file", () => {
  it.each([
    ["en", en, "This file is too large. The maximum size is 10 MB.", "Files of type application/zip are not accepted."],
    ["fr", fr, "Ce fichier est trop volumineux. La taille maximale est de 10 Mo.", "Les fichiers de type application/zip ne sont pas acceptés."],
  ] as const)("exist in the message files, and say what the validation gives them (%s)", (locale, messages, tooLarge, type) => {
    const translate = (message: string, values: Record<string, string | number>) =>
      message.replaceAll(/\{(\w+)(?:, number)?\}/g, (_, name: string) => String(values[name]));

    expect(translate(messages.upload.tooLarge, { max: 10 })).toBe(tooLarge);
    expect(translate(messages.upload.typeNotAllowed, { type: "application/zip" })).toBe(type);
    expect(locale).toBeTruthy();
  });
});

describe("what the upload tells when it failed", () => {
  const translate = (key: string, values?: Record<string, string | number>) => `${key}:${JSON.stringify(values)}`;
  const refusal = (code: string, values: Record<string, string | number>) => ({ error: "an English sentence", code, status: 400, values });

  it.each([
    ["a file that is too large", "FILE_TOO_LARGE", { max: 10 }, 'upload.tooLarge:{"max":10}'],
    ["a type that is not taken", "FILE_TYPE_NOT_ALLOWED", { type: "application/zip" }, 'upload.typeNotAllowed:{"type":"application/zip"}'],
  ])("tells %s in the words of the page: the message its code names, with its values", (_, code, values, told) => {
    expect(failureMessage(new UploadFailed(400, refusal(code, values)), translate)).toBe(told);
  });

  it.each([
    ["an answer that is not a 400", new UploadFailed(500, refusal("FILE_TOO_LARGE", { max: 10 }))],
    ["a 403", new UploadFailed(403, refusal("FILE_TOO_LARGE", { max: 10 }))],
    ["a 400 for another reason", new UploadFailed(400, { error: "No active organization", code: "NO_ORG", status: 400 })],
    ["a 400 for fields that are missing", new UploadFailed(400, { error: "Missing required fields", code: "MISSING_FIELDS", status: 400 })],
    ["a 400 that holds no code", new UploadFailed(400, { error: "Bad" })],
    ["a 400 that is no JSON", new UploadFailed(400, null)],
    ["a 400 whose code is no refusal of the route", new UploadFailed(400, refusal("toString", {}))],
    ["a network that is down", new UploadFailed(0, null)],
    ["anything else", "oops"],
  ])("tells %s as the generic failure of the message files", (_, failure) => {
    expect(failureMessage(failure, translate)).toBe("upload.failed:undefined");
  });

  it("gives the message of a refusal no values when the body holds none, or holds ones it cannot use", () => {
    expect(failureMessage(new UploadFailed(400, { code: "FILE_TOO_LARGE" }), translate)).toBe("upload.tooLarge:{}");
    expect(failureMessage(new UploadFailed(400, { code: "FILE_TOO_LARGE", values: { max: { nested: true } } }), translate)).toBe("upload.tooLarge:{}");
  });
});
