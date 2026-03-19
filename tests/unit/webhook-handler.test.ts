import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

/**
 * Example test: Webhook signature verification.
 *
 * Tests the HMAC-SHA256 signing logic used in webhook delivery.
 */

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return signature === expected;
}

describe("webhook signature verification", () => {
  const secret = "whsec_test-secret-123";

  it("verifies a valid signature", () => {
    const payload = JSON.stringify({ event: "test", data: {} });
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    const payload = JSON.stringify({ event: "test", data: {} });
    expect(verifyWebhookSignature(payload, "invalid-signature", secret)).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const originalPayload = JSON.stringify({ event: "test", data: {} });
    const signature = createHmac("sha256", secret).update(originalPayload).digest("hex");
    const tamperedPayload = JSON.stringify({ event: "test", data: { hacked: true } });
    expect(verifyWebhookSignature(tamperedPayload, signature, secret)).toBe(false);
  });
});
