import { describe, expect, it } from "vitest";
import { KeyStatusBadge } from "@/features/api-keys/components/key-status-badge";
import { apiKeyStatus } from "@/features/api-keys/key-status";
import { decodedClassesOf, startTags, tagSaying, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

type Locale = "en" | "fr";
type Status = "active" | "expired" | "revoked";

describe("the status of an API key", () => {
  const badge = (status: Status, locale: Locale = "en") =>
    renderWithIntl(<KeyStatusBadge status={status} />, locale);
  const classesOf = (html: string) => decodedClassesOf(startTags(html, "span")[0] ?? "");

  it("tells an active key from a revoked one in words and tone", () => {
    const active = badge("active");
    const expired = badge("expired");
    const revoked = badge("revoked");

    expect(textOf(active)).toBe("Active");
    expect(textOf(expired)).toBe("Expired");
    expect(textOf(revoked)).toBe("Revoked");

    // Only a key that can be used wears the success tone; one that cannot is neutral, whatever the reason
    expect(classesOf(active)).toEqual(expect.arrayContaining(["bg-success-bg", "text-success-text"]));
    for (const dead of [expired, revoked]) {
      expect(classesOf(dead)).toContain("bg-secondary");
      expect(classesOf(dead)).not.toContain("bg-success-bg");
      expect(classesOf(dead)).not.toContain("bg-danger");
    }
  });

  it("says the status in French too, and stays a small badge", () => {
    expect(textOf(badge("active", "fr"))).toBe("Active");
    expect(textOf(badge("expired", "fr"))).toBe("Expirée");
    expect(textOf(badge("revoked", "fr"))).toBe("Révoquée");
    expect(classesOf(badge("active"))).toContain("text-caption");
    expect(tagSaying(badge("active"), "span", "Active")).toContain('data-slot="badge"');
  });
});

describe("the status a key has at a given moment", () => {
  const NOW = new Date("2026-11-04T12:00:00.000Z");
  const at = (iso: string) => new Date(iso);

  it("is active while the key is not revoked and has no end, or has one that is not come", () => {
    expect(apiKeyStatus({ revokedAt: null, expiresAt: null }, NOW)).toBe("active");
    expect(apiKeyStatus({ revokedAt: null, expiresAt: at("2026-11-04T12:00:01.000Z") }, NOW)).toBe("active");
    expect(apiKeyStatus({ revokedAt: null, expiresAt: at("2027-01-01T00:00:00.000Z") }, NOW)).toBe("active");
  });

  it("is expired once the end has come, on the very moment too: a key is usable only before it", () => {
    expect(apiKeyStatus({ revokedAt: null, expiresAt: at("2026-11-04T11:59:59.999Z") }, NOW)).toBe("expired");
    expect(apiKeyStatus({ revokedAt: null, expiresAt: NOW }, NOW)).toBe("expired");
  });

  it("is revoked when the key was revoked, whatever its end: a revoked key stays revoked after it has run out", () => {
    expect(apiKeyStatus({ revokedAt: at("2026-11-01T00:00:00.000Z"), expiresAt: null }, NOW)).toBe("revoked");
    expect(apiKeyStatus({ revokedAt: at("2026-11-01T00:00:00.000Z"), expiresAt: at("2026-12-01T00:00:00.000Z") }, NOW)).toBe("revoked");
    expect(apiKeyStatus({ revokedAt: at("2026-11-01T00:00:00.000Z"), expiresAt: at("2026-10-01T00:00:00.000Z") }, NOW)).toBe("revoked");
  });
});
