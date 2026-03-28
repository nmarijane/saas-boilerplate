import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/agent-docs/route";

describe("GET /api/agent-docs", () => {
  it("returns 200 with valid schema structure", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.schema_version).toBe("1.0");
    expect(body.generated_at).toBeTruthy();
    expect(Array.isArray(body.endpoints)).toBe(true);
    expect(body.endpoints.length).toBeGreaterThan(0);
  });

  it("includes /api/health endpoint", async () => {
    const response = await GET();
    const body = await response.json();

    const health = body.endpoints.find(
      (e: { path: string }) => e.path === "/api/health",
    );
    expect(health).toBeDefined();
    expect(health.method).toBe("GET");
    expect(health.auth_required).toBe(false);
  });

  it("includes auth info with bearer format", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.auth.type).toBe("bearer");
    expect(body.auth.header).toBe("Authorization");
    expect(body.auth.format).toContain("Bearer");
  });

  it("includes X-Agent-Docs response header", async () => {
    const response = await GET();
    expect(response.headers.get("X-Agent-Docs")).toBe("true");
  });

  it("generated_at is a valid ISO 8601 date", async () => {
    const response = await GET();
    const body = await response.json();

    const date = new Date(body.generated_at);
    expect(date.toISOString()).toBe(body.generated_at);
  });

  it("all endpoints have required fields: method, path, description", async () => {
    const response = await GET();
    const body = await response.json();

    for (const endpoint of body.endpoints) {
      expect(endpoint.method).toBeTruthy();
      expect(endpoint.path).toBeTruthy();
      expect(endpoint.description).toBeTruthy();
    }
  });
});
