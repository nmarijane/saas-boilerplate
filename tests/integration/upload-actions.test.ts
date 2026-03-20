import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { upload } from "@/models/upload";
import { seedOrg, seedUpload, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

const mockPut = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);

vi.mock("@/features/upload/storage/adapter", () => ({
  getStorageAdapter: vi.fn().mockResolvedValue({
    put: (...args: unknown[]) => mockPut(...args),
    get: vi.fn(),
    delete: (...args: unknown[]) => mockDelete(...args),
  }),
}));

vi.mock("@/features/upload/validation", () => ({
  validateFile: vi.fn().mockReturnValue({ valid: true }),
}));

const UPLOAD_USER = "test-user-1";
const UPLOAD_ORG = "test-org-1";

describe("upload actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await testDb.delete(upload);
    await seedUser(UPLOAD_USER);
    await seedOrg(UPLOAD_ORG);
  });

  describe("uploadFile", () => {
    it("uploads a file and inserts a record in DB", async () => {
      const { uploadFile } = await import("@/features/upload/actions");

      const mockFile = new File(["test content"], "test.png", { type: "image/png" });
      const formData = new FormData();
      formData.set("file", mockFile);
      formData.set("userId", UPLOAD_USER);
      formData.set("orgId", UPLOAD_ORG);

      const result = await uploadFile(formData);

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("filename", "test.png");
      expect(result).not.toHaveProperty("error");

      // Verify storage adapter was called
      expect(mockPut).toHaveBeenCalledOnce();
      const putArgs = mockPut.mock.calls[0];
      expect(putArgs[0]).toContain(UPLOAD_ORG);
      expect(putArgs[0]).toContain("test.png");
      expect(putArgs[2]).toBe("image/png");

      // Verify DB record was created
      const rows = await testDb.select().from(upload);
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(UPLOAD_USER);
      expect(rows[0].organizationId).toBe(UPLOAD_ORG);
      expect(rows[0].filename).toBe("test.png");
      expect(rows[0].mimetype).toBe("image/png");
      expect(rows[0].size).toBe(mockFile.size);
    });

    it("returns error when file is missing", async () => {
      const { uploadFile } = await import("@/features/upload/actions");

      const formData = new FormData();
      formData.set("userId", UPLOAD_USER);
      formData.set("orgId", UPLOAD_ORG);

      const result = await uploadFile(formData);

      expect(result).toEqual({ error: "Missing required fields" });
      expect(mockPut).not.toHaveBeenCalled();

      const rows = await testDb.select().from(upload);
      expect(rows).toHaveLength(0);
    });

    it("returns error when userId is missing", async () => {
      const { uploadFile } = await import("@/features/upload/actions");

      const mockFile = new File(["test content"], "test.png", { type: "image/png" });
      const formData = new FormData();
      formData.set("file", mockFile);
      formData.set("orgId", UPLOAD_ORG);

      const result = await uploadFile(formData);

      expect(result).toEqual({ error: "Missing required fields" });
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("returns error when orgId is missing", async () => {
      const { uploadFile } = await import("@/features/upload/actions");

      const mockFile = new File(["test content"], "test.png", { type: "image/png" });
      const formData = new FormData();
      formData.set("file", mockFile);
      formData.set("userId", UPLOAD_USER);

      const result = await uploadFile(formData);

      expect(result).toEqual({ error: "Missing required fields" });
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("returns error when file validation fails", async () => {
      const { validateFile } = await import("@/features/upload/validation");
      vi.mocked(validateFile).mockReturnValue({
        valid: false,
        error: "File too large. Maximum size is 10MB.",
      });

      const { uploadFile } = await import("@/features/upload/actions");

      const mockFile = new File(["test content"], "huge.zip", { type: "application/zip" });
      const formData = new FormData();
      formData.set("file", mockFile);
      formData.set("userId", UPLOAD_USER);
      formData.set("orgId", UPLOAD_ORG);

      const result = await uploadFile(formData);

      expect(result).toEqual({ error: "File too large. Maximum size is 10MB." });
      expect(mockPut).not.toHaveBeenCalled();

      const rows = await testDb.select().from(upload);
      expect(rows).toHaveLength(0);
    });
  });

  describe("deleteFile", () => {
    it("deletes an existing file from storage and DB", async () => {
      const seeded = await seedUpload(UPLOAD_USER, {
        id: "upload-del-1",
        storageKey: "uploads/upload-del-1",
      });

      const { deleteFile } = await import("@/features/upload/actions");

      const result = await deleteFile(seeded.id);

      expect(result).toEqual({ success: true });

      // Verify storage adapter delete was called with the correct key
      expect(mockDelete).toHaveBeenCalledOnce();
      expect(mockDelete).toHaveBeenCalledWith(seeded.storageKey);

      // Verify DB record was removed
      const rows = await testDb
        .select()
        .from(upload)
        .where(eq(upload.id, seeded.id));
      expect(rows).toHaveLength(0);
    });

    it("returns error when file is not found", async () => {
      const { deleteFile } = await import("@/features/upload/actions");

      const result = await deleteFile("non-existent-id");

      expect(result).toEqual({ error: "File not found" });
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("does not affect other upload records", async () => {
      await seedUpload(UPLOAD_USER, { id: "upload-keep-1" });
      await seedUpload(UPLOAD_USER, { id: "upload-remove-1" });

      const { deleteFile } = await import("@/features/upload/actions");

      await deleteFile("upload-remove-1");

      const remaining = await testDb.select().from(upload);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("upload-keep-1");
    });
  });
});
