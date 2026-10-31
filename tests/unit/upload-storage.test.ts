import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { LocalStorageAdapter } from "@/features/upload/storage/local";
import { contentDisposition, storageSafeName } from "@/features/upload/validation";

describe("storageSafeName", () => {
  it("drops any directory part, with either separator", () => {
    expect(storageSafeName("../../../etc/passwd")).toBe("passwd");
    expect(storageSafeName("..\\..\\boot.ini")).toBe("boot.ini");
  });

  it("never returns a dot-only or empty name", () => {
    expect(storageSafeName("..")).toBe("file");
    expect(storageSafeName("")).toBe("file");
    expect(storageSafeName(".env")).toBe("env");
  });

  it("replaces unusual characters and bounds the length", () => {
    expect(storageSafeName("rapport final é.pdf")).toBe("rapport_final__.pdf");
    expect(storageSafeName(`${"a".repeat(300)}.png`)).toHaveLength(100);
  });
});

describe("contentDisposition", () => {
  it("displays raster images and PDF inline", () => {
    expect(contentDisposition("image/png", "a.png")).toMatch(/^inline;/);
    expect(contentDisposition("application/pdf", "a.pdf")).toMatch(/^inline;/);
  });

  it("downloads SVG and every other type, so they cannot run scripts on the app origin", () => {
    expect(contentDisposition("image/svg+xml", "a.svg")).toMatch(/^attachment;/);
    expect(contentDisposition("text/plain", "a.txt")).toMatch(/^attachment;/);
    expect(contentDisposition("application/json", "a.json")).toMatch(/^attachment;/);
  });

  it("keeps the header on one line, with an ASCII fallback and an encoded name", () => {
    const header = contentDisposition("image/png", "a\"\r\nSet-Cookie: x=1 é.png");
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).toContain("filename=\"a___Set-Cookie: x=1 _.png\"");
    expect(header).toContain("filename*=UTF-8''a%22%0D%0ASet-Cookie%3A%20x%3D1%20%C3%A9.png");
  });
});

describe("local storage adapter", () => {
  const adapter = new LocalStorageAdapter();

  it("rejects keys that resolve outside the uploads directory", async () => {
    for (const key of ["../outside.txt", "org/../../outside.txt", "/etc/passwd"]) {
      await expect(adapter.put(key, Buffer.from("x"), "text/plain")).rejects.toThrow("Invalid storage key");
      await expect(adapter.get(key)).rejects.toThrow("Invalid storage key");
      await expect(adapter.delete(key)).rejects.toThrow("Invalid storage key");
    }
  });
});
