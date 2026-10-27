import { beforeEach, describe, expect, it } from "vitest";
import { getPublishedTools, getToolBySlug } from "@/features/tools/queries";
import { aiTools } from "@/models";
import { testDb } from "../setup";

describe("retired example tool", () => {
  beforeEach(async () => {
    await testDb.delete(aiTools);
    await testDb.insert(aiTools).values([
      {
        id: "old-example",
        slug: "organise-disclosure-material",
        name: "Old example",
        type: "form",
        status: "published",
      },
      {
        id: "future-tool",
        slug: "future-tool",
        name: "Future tool",
        type: "form",
        status: "published",
      },
    ]);
  });

  it("excludes old seeded example data without hiding other published tools", async () => {
    expect((await getPublishedTools()).map((tool) => tool.id)).toEqual([
      "future-tool",
    ]);
  });

  it("blocks direct access to the retired example before data migration", async () => {
    expect(await getToolBySlug("organise-disclosure-material")).toBeNull();
    expect((await getToolBySlug("future-tool"))?.id).toBe("future-tool");
  });
});
