import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { PROJECT_STATUSES } from "@/features/projects/schemas";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { hardCodedCopy, keysAsked, messageAt } from "../../helpers/copy";

/**
 * The words of the projects: every one comes from the message files, which
 * hold it in both languages (tests/unit/i18n/messages-parity.test.ts keeps the
 * two files in step, and the labels the shell names).
 */

const ROOT = resolve(import.meta.dirname, "../../..");

/** The sources of the feature that draw words: its components and its pages. */
const FOLDERS = ["src/features/projects/components", "src/app/[locale]/(app)/(shell)/projects"];

function sourcesOf(folder: string): string[] {
  return readdirSync(join(ROOT, folder), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx$/.test(file) && !/\.stories\.tsx$/.test(file))
    .map((file) => `${folder}/${file.split("\\").join("/")}`)
    .sort();
}

const files = FOLDERS.flatMap(sourcesOf);

describe("the words of the projects", () => {
  it("looks at the components and the pages of the feature", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "src/features/projects/components/project-card.tsx",
        "src/app/[locale]/(app)/(shell)/projects/(list)/page.tsx",
      ]),
    );
  });

  it.each(files)("are written in no component: %s", (file) => {
    expect(hardCodedCopy(readFileSync(join(ROOT, file), "utf-8"))).toEqual([]);
  });

  it("exist in English and in French, every one a component or a page asks for", () => {
    const keys = [...new Set(files.flatMap((file) => keysAsked(readFileSync(join(ROOT, file), "utf-8"))))];

    // The scan has to find the words, or it checks nothing
    expect(keys.length).toBeGreaterThan(25);
    for (const [locale, messages] of [["en", en], ["fr", fr]] as const) {
      const missing = keys.filter((key) => messageAt(messages, key) === undefined);

      expect(missing, `${locale}.json lacks messages the projects ask for`).toEqual([]);
    }
  });

  it("has a word for each status a project can be in, and each way the shell names the feature", () => {
    for (const messages of [en, fr]) {
      for (const status of PROJECT_STATUSES) {
        expect(messageAt(messages, `projects.status.${status}`), status).toBeTruthy();
      }
      for (const key of ["projects.nav", "projects.task", "projects.taskAction", "quotas.projects"]) {
        expect(messageAt(messages, key), key).toBeTruthy();
      }
    }
  });
});

describe("the number of projects", () => {
  const count = (locale: "en" | "fr", projects: number) =>
    createTranslator({ locale, messages: locale === "en" ? en : fr, namespace: "projects" })("count", { count: projects });

  it("is plural the English way: one project, otherwise projects, none included", () => {
    expect([0, 1, 2, 5, 21].map((projects) => count("en", projects))).toEqual([
      "0 projects",
      "1 project",
      "2 projects",
      "5 projects",
      "21 projects",
    ]);
  });

  it("is plural the French way: zero and one are singular, from two on projets", () => {
    expect([0, 1, 2, 5, 21].map((projects) => count("fr", projects))).toEqual([
      "0 projet",
      "1 projet",
      "2 projets",
      "5 projets",
      "21 projets",
    ]);
  });
});
