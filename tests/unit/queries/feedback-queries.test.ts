import { beforeEach, describe, expect, it } from "vitest";
import { feedback } from "@/models/feedback";
import { seedFeedback, seedOrg, seedUser } from "../../helpers/seed";
import { testDb } from "../../setup";

const FB_USER = "fb-q-user-1";
const FB_ORG_1 = "fb-q-org-1";
const FB_ORG_2 = "fb-q-org-2";

describe("feedback queries", () => {
  beforeEach(async () => {
    await testDb.delete(feedback);
    await seedUser(FB_USER);
    await seedOrg(FB_ORG_1, { slug: "fb-q-org-1" });
    await seedOrg(FB_ORG_2, { slug: "fb-q-org-2" });
  });

  describe("getFeedbacks", () => {
    it("returns an empty array when no feedback exists", async () => {
      const { getFeedbacks } = await import("@/features/feedback/queries");

      const result = await getFeedbacks();

      expect(result).toEqual([]);
    });

    it("returns all feedback when no filters are applied", async () => {
      await seedFeedback(FB_USER, { id: "fb-q-1", status: "new" });
      await seedFeedback(FB_USER, { id: "fb-q-2", status: "reviewed" });
      await seedFeedback(FB_USER, { id: "fb-q-3", status: "done" });

      const { getFeedbacks } = await import("@/features/feedback/queries");

      const result = await getFeedbacks();

      expect(result).toHaveLength(3);
    });

    it("filters by status", async () => {
      await seedFeedback(FB_USER, { id: "fb-q-s1", status: "new" });
      await seedFeedback(FB_USER, { id: "fb-q-s2", status: "reviewed" });
      await seedFeedback(FB_USER, { id: "fb-q-s3", status: "new" });

      const { getFeedbacks } = await import("@/features/feedback/queries");

      const result = await getFeedbacks({ status: "new" });

      expect(result).toHaveLength(2);
      expect(result.every((f) => f.status === "new")).toBe(true);
    });

    it("returns empty when filtering by status with no matches", async () => {
      await seedFeedback(FB_USER, { id: "fb-q-ns1", status: "new" });

      const { getFeedbacks } = await import("@/features/feedback/queries");

      const result = await getFeedbacks({ status: "done" });

      expect(result).toEqual([]);
    });

    it("filters by orgId", async () => {
      await seedFeedback(FB_USER, {
        id: "fb-q-o1",
        organizationId: FB_ORG_1,
      });
      await seedFeedback(FB_USER, {
        id: "fb-q-o2",
        organizationId: FB_ORG_2,
      });
      await seedFeedback(FB_USER, {
        id: "fb-q-o3",
        organizationId: FB_ORG_1,
      });

      const { getFeedbacks } = await import("@/features/feedback/queries");

      const result = await getFeedbacks({ orgId: FB_ORG_1 });

      expect(result).toHaveLength(2);
      expect(result.every((f) => f.organizationId === FB_ORG_1)).toBe(true);
    });

    it("returns empty when filtering by orgId with no matches", async () => {
      await seedFeedback(FB_USER, { id: "fb-q-no1" });

      const { getFeedbacks } = await import("@/features/feedback/queries");

      const result = await getFeedbacks({ orgId: "nonexistent-org" });

      expect(result).toEqual([]);
    });

    it("orders results by createdAt descending", async () => {
      const past = new Date("2025-01-01");
      const recent = new Date("2025-06-01");

      await seedFeedback(FB_USER, { id: "fb-q-old", createdAt: past });
      await seedFeedback(FB_USER, { id: "fb-q-new", createdAt: recent });

      const { getFeedbacks } = await import("@/features/feedback/queries");

      const result = await getFeedbacks();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("fb-q-new");
      expect(result[1].id).toBe("fb-q-old");
    });

    it("passes empty options object by default", async () => {
      await seedFeedback(FB_USER, { id: "fb-q-def1" });

      const { getFeedbacks } = await import("@/features/feedback/queries");

      const result = await getFeedbacks({});

      expect(result).toHaveLength(1);
    });
  });
});
