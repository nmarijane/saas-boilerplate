import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createChangelogEntry,
  deleteChangelogEntry,
  updateChangelogEntry,
} from "@/features/changelog/actions";
import { getChangelogEntries } from "@/features/changelog/queries";
import { changelogEntry } from "@/models/changelog";
import { testDb } from "../setup";

describe("changelog", () => {
  beforeEach(async () => {
    await testDb.delete(changelogEntry);
  });

  describe("actions", () => {
    it("createChangelogEntry inserts entry", async () => {
      await createChangelogEntry({
        title: "v1.0 Release",
        content: "Initial release with core features.",
        version: "1.0.0",
      });

      const entries = await testDb.select().from(changelogEntry);
      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe("v1.0 Release");
      expect(entries[0].content).toBe("Initial release with core features.");
      expect(entries[0].version).toBe("1.0.0");
    });

    it("updateChangelogEntry updates entry", async () => {
      await createChangelogEntry({
        title: "Original Title",
        content: "Original content.",
      });

      const [entry] = await testDb.select().from(changelogEntry);

      await updateChangelogEntry(entry.id, {
        title: "Updated Title",
      });

      const updated = await testDb.query.changelogEntry.findFirst({
        where: eq(changelogEntry.id, entry.id),
      });
      expect(updated?.title).toBe("Updated Title");
      expect(updated?.content).toBe("Original content.");
    });

    it("deleteChangelogEntry removes entry", async () => {
      await createChangelogEntry({
        title: "To Be Deleted",
        content: "Goodbye.",
      });

      const [entry] = await testDb.select().from(changelogEntry);
      await deleteChangelogEntry(entry.id);

      const remaining = await testDb.select().from(changelogEntry);
      expect(remaining).toHaveLength(0);
    });
  });

  describe("queries", () => {
    it("getChangelogEntries returns entries ordered by publishedAt desc", async () => {
      await createChangelogEntry({
        title: "Old Entry",
        content: "Old.",
        publishedAt: new Date("2025-01-01"),
      });
      await createChangelogEntry({
        title: "New Entry",
        content: "New.",
        publishedAt: new Date("2025-06-01"),
      });

      const entries = await getChangelogEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].title).toBe("New Entry");
      expect(entries[1].title).toBe("Old Entry");
    });
  });
});
