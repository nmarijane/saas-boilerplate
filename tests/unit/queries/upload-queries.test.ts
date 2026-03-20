import { beforeEach, describe, expect, it } from "vitest";
import { upload } from "@/models/upload";
import { seedOrg, seedUpload, seedUser } from "../../helpers/seed";
import { testDb } from "../../setup";

const UP_USER = "up-q-user-1";
const UP_ORG_1 = "up-q-org-1";
const UP_ORG_2 = "up-q-org-2";

describe("upload queries", () => {
  beforeEach(async () => {
    await testDb.delete(upload);
    await seedUser(UP_USER);
    await seedOrg(UP_ORG_1, { slug: "up-q-org-1" });
    await seedOrg(UP_ORG_2, { slug: "up-q-org-2" });
  });

  describe("getFilesByOrg", () => {
    it("returns an empty array when org has no files", async () => {
      const { getFilesByOrg } = await import("@/features/upload/queries");

      const result = await getFilesByOrg(UP_ORG_1);

      expect(result).toEqual([]);
    });

    it("returns files for the given org only", async () => {
      await seedUpload(UP_USER, {
        id: "up-q-1",
        organizationId: UP_ORG_1,
      });
      await seedUpload(UP_USER, {
        id: "up-q-2",
        organizationId: UP_ORG_1,
      });
      await seedUpload(UP_USER, {
        id: "up-q-3",
        organizationId: UP_ORG_2,
      });

      const { getFilesByOrg } = await import("@/features/upload/queries");

      const result = await getFilesByOrg(UP_ORG_1);

      expect(result).toHaveLength(2);
      expect(result.every((f) => f.organizationId === UP_ORG_1)).toBe(true);
    });

    it("orders results by createdAt descending", async () => {
      const past = new Date("2025-01-01");
      const recent = new Date("2025-06-01");

      await seedUpload(UP_USER, {
        id: "up-q-old",
        organizationId: UP_ORG_1,
        createdAt: past,
      });
      await seedUpload(UP_USER, {
        id: "up-q-new",
        organizationId: UP_ORG_1,
        createdAt: recent,
      });

      const { getFilesByOrg } = await import("@/features/upload/queries");

      const result = await getFilesByOrg(UP_ORG_1);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("up-q-new");
      expect(result[1].id).toBe("up-q-old");
    });

    it("returns empty for a nonexistent org", async () => {
      await seedUpload(UP_USER, {
        id: "up-q-ne",
        organizationId: UP_ORG_1,
      });

      const { getFilesByOrg } = await import("@/features/upload/queries");

      const result = await getFilesByOrg("nonexistent-org");

      expect(result).toEqual([]);
    });
  });

  describe("getFileById", () => {
    it("returns the file when it exists", async () => {
      await seedUpload(UP_USER, {
        id: "up-q-by-id",
        filename: "report.pdf",
        mimetype: "application/pdf",
        size: 2048,
      });

      const { getFileById } = await import("@/features/upload/queries");

      const result = await getFileById("up-q-by-id");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("up-q-by-id");
      expect(result?.filename).toBe("report.pdf");
      expect(result?.mimetype).toBe("application/pdf");
      expect(result?.size).toBe(2048);
    });

    it("returns null when the file does not exist", async () => {
      const { getFileById } = await import("@/features/upload/queries");

      const result = await getFileById("nonexistent-id");

      expect(result).toBeNull();
    });

    it("returns the correct file among multiple", async () => {
      await seedUpload(UP_USER, {
        id: "up-q-multi-1",
        filename: "a.png",
      });
      await seedUpload(UP_USER, {
        id: "up-q-multi-2",
        filename: "b.png",
      });

      const { getFileById } = await import("@/features/upload/queries");

      const result = await getFileById("up-q-multi-2");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("up-q-multi-2");
      expect(result?.filename).toBe("b.png");
    });
  });
});
