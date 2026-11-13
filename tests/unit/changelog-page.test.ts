import { describe, expect, it } from "vitest";
import * as changelogPage from "@/app/[locale]/(marketing)/changelog/page";

/**
 * The public changelog reads its entries from the database. A page that the build
 * draws queries at build time: `next build` opened ./local.db, which `npm run dev`
 * may be holding, and a second process on a PGlite directory breaks it.
 */
describe("the public changelog page", () => {
  it("is drawn for each request, never by the build", () => {
    expect(changelogPage.dynamic).toBe("force-dynamic");
  });
});
