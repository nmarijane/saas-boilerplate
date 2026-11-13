import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WaitlistPage from "@/app/[locale]/(marketing)/waitlist/page";
import { WaitlistPageClient } from "@/features/waitlist/components/waitlist-page-client";
import { waitlistEntry } from "@/models/waitlist";
import { testDb } from "../setup";

/**
 * The waitlist page tells a position to whoever has a referral code, which joining answers with. It does not tell
 * it for an address: any address is anybody's to type, and the page would answer whether it is on the list.
 */

vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));

async function drawn(searchParams: { email?: string; code?: string }) {
  const element = (await WaitlistPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve(searchParams) } as never)) as ReactElement;

  return find(element)?.props as { initialPosition?: number; initialReferralCode?: string; initialReferralCount?: number } | undefined;
}

function find(node: unknown): ReactElement<Record<string, unknown>> | undefined {
  if (typeof node !== "object" || node === null) {
    return undefined;
  }
  const element = node as ReactElement<{ children?: unknown }>;
  if (element.type === WaitlistPageClient) {
    return element as ReactElement<Record<string, unknown>>;
  }
  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = find(child);
    if (found) {
      return found;
    }
  }

  return undefined;
}

beforeEach(async () => {
  await testDb.delete(waitlistEntry);
  await testDb.insert(waitlistEntry).values([
    { id: "w1", email: "known@example.com", referralCode: "CODE1", referralCount: 2, status: "waiting", createdAt: new Date(Date.UTC(2026, 0, 1)) },
    { id: "w2", email: "other@example.com", referralCode: "CODE2", referralCount: 0, status: "waiting", createdAt: new Date(Date.UTC(2026, 0, 2)) },
  ]);
});

describe("the waitlist page", () => {
  it("shows a position and the code for a referral code", async () => {
    const props = await drawn({ code: "CODE2" });

    expect(props).toMatchObject({ initialReferralCode: "CODE2", initialPosition: expect.any(Number) });
  });

  it.each(["known@example.com", "other@example.com", "nobody@example.com"])("shows nothing for the address %s in the query, whether it is on the list or not", async (email) => {
    const props = await drawn({ email });

    expect(props?.initialPosition).toBeUndefined();
    expect(props?.initialReferralCode).toBeUndefined();
  });

  it("shows nothing for a code that is nobody's, or too long to be one", async () => {
    expect((await drawn({ code: "NOPE" }))?.initialPosition).toBeUndefined();
    expect((await drawn({ code: "X".repeat(40) }))?.initialPosition).toBeUndefined();
  });

  it("shows nothing for an address and a code that is not its own: the address is not read", async () => {
    const props = await drawn({ email: "known@example.com", code: "CODE2" });

    expect(props?.initialReferralCode).toBe("CODE2");
  });
});
