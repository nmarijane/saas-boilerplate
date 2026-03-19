import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { feedback } from "@/models/feedback";
import { seedFeedback, seedOrg, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

const FB_USER = "fb-user-1";
const FB_ORG = "fb-org-1";

describe("feedback actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(feedback);
    await seedUser(FB_USER);
    await seedOrg(FB_ORG);
  });

  describe("submitFeedback", () => {
    it("creates feedback with required fields", async () => {
      const { submitFeedback } = await import(
        "@/features/feedback/actions"
      );

      const result = await submitFeedback({
        userId: FB_USER,
        type: "bug",
        message: "The button is broken",
      });

      expect(result.id).toBeDefined();

      const rows = await testDb
        .select()
        .from(feedback)
        .where(eq(feedback.userId, FB_USER));

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe("bug");
      expect(rows[0].message).toBe("The button is broken");
      expect(rows[0].status).toBe("new");
      expect(rows[0].organizationId).toBeNull();
    });

    it("creates feedback with orgId", async () => {
      const { submitFeedback } = await import(
        "@/features/feedback/actions"
      );

      await submitFeedback({
        userId: FB_USER,
        orgId: FB_ORG,
        type: "feature",
        message: "Add dark mode",
      });

      const rows = await testDb
        .select()
        .from(feedback)
        .where(eq(feedback.userId, FB_USER));

      expect(rows[0].organizationId).toBe(FB_ORG);
    });

    it("appends screenshot link when screenshotId is provided", async () => {
      const { submitFeedback } = await import(
        "@/features/feedback/actions"
      );

      await submitFeedback({
        userId: FB_USER,
        type: "bug",
        message: "It crashes",
        screenshotId: "upload-abc123",
      });

      const rows = await testDb
        .select()
        .from(feedback)
        .where(eq(feedback.userId, FB_USER));

      expect(rows[0].message).toContain("It crashes");
      expect(rows[0].message).toContain("[Screenshot: /api/upload/upload-abc123]");
    });

    it("does not append screenshot link when screenshotId is absent", async () => {
      const { submitFeedback } = await import(
        "@/features/feedback/actions"
      );

      await submitFeedback({
        userId: FB_USER,
        type: "other",
        message: "Just a thought",
      });

      const rows = await testDb
        .select()
        .from(feedback)
        .where(eq(feedback.userId, FB_USER));

      expect(rows[0].message).toBe("Just a thought");
      expect(rows[0].message).not.toContain("[Screenshot:");
    });
  });

  describe("updateFeedbackStatus", () => {
    it("updates status to reviewed", async () => {
      const fb = await seedFeedback(FB_USER, { id: "fb-status-1", status: "new" });

      const { updateFeedbackStatus } = await import(
        "@/features/feedback/actions"
      );

      await updateFeedbackStatus(fb.id, "reviewed");

      const rows = await testDb
        .select()
        .from(feedback)
        .where(eq(feedback.id, fb.id));

      expect(rows[0].status).toBe("reviewed");
    });

    it("updates status to done", async () => {
      const fb = await seedFeedback(FB_USER, { id: "fb-status-2", status: "reviewed" });

      const { updateFeedbackStatus } = await import(
        "@/features/feedback/actions"
      );

      await updateFeedbackStatus(fb.id, "done");

      const rows = await testDb
        .select()
        .from(feedback)
        .where(eq(feedback.id, fb.id));

      expect(rows[0].status).toBe("done");
    });

    it("does not affect other feedback entries", async () => {
      await seedFeedback(FB_USER, { id: "fb-status-3a", status: "new" });
      await seedFeedback(FB_USER, { id: "fb-status-3b", status: "new" });

      const { updateFeedbackStatus } = await import(
        "@/features/feedback/actions"
      );

      await updateFeedbackStatus("fb-status-3a", "done");

      const other = await testDb
        .select()
        .from(feedback)
        .where(eq(feedback.id, "fb-status-3b"));

      expect(other[0].status).toBe("new");
    });
  });
});
