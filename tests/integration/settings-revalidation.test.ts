import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApiKeyAction, revokeApiKeyAction } from "@/features/api-keys/actions";
import { requireRole } from "@/features/auth/guards";
import { updateProfile } from "@/features/settings/actions";
import {
  createWebhookEndpointAction,
  deleteWebhookEndpointAction,
  toggleWebhookEndpointAction,
} from "@/features/webhooks/actions";
import { apiKey, webhookEndpoint } from "@/models";
import { madeKey } from "../helpers/api-keys";
import { seedOrg, seedUser } from "../helpers/seed";
import { fakeRoleGrant } from "../helpers/session";
import { testDb } from "../setup";

/**
 * The settings pages changed their addresses (src/shared/config/redirects.ts):
 * `/settings/profile` is `/settings/account` and `/settings/api` is
 * `/settings/developers`. An action that changes what a page shows reads that
 * page again by its address, so each of them has to name the new one: the old
 * address now only redirects, and a page that is not read again keeps showing
 * what it showed before the action.
 */

const ORG_ID = "rv-org-1";
const USER_ID = "test-user-1";

/** The addresses an action asked to read again. */
function revalidated(): string[] {
  return vi.mocked(revalidatePath).mock.calls.map(([path]) => path);
}

describe("the pages that the settings actions read again", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(fakeRoleGrant(USER_ID, "admin"));
    await testDb.delete(apiKey);
    await testDb.delete(webhookEndpoint);
    await seedUser(USER_ID);
    await seedOrg(ORG_ID);
  });

  it("is the account page, after the profile changes", async () => {
    await updateProfile({ name: "Camille" });

    expect(revalidated()).toEqual(["/settings/account"]);
  });

  it("is the developers page, after an API key is made and after it is revoked", async () => {
    const key = madeKey(await createApiKeyAction(ORG_ID, { name: "CI", scopes: ["read"] }));
    expect(revalidated()).toEqual(["/settings/developers"]);

    vi.mocked(revalidatePath).mockClear();
    await revokeApiKeyAction(key.id, ORG_ID);

    expect(revalidated()).toEqual(["/settings/developers"]);
  });

  it("is the developers page, after a webhook endpoint is made, turned off and deleted", async () => {
    const endpoint = await createWebhookEndpointAction(ORG_ID, {
      url: "https://example.com/hook",
      events: ["payment.succeeded"],
    });
    await toggleWebhookEndpointAction(endpoint.id, ORG_ID, false);
    await deleteWebhookEndpointAction(endpoint.id, ORG_ID);

    expect(revalidated()).toEqual(["/settings/developers", "/settings/developers", "/settings/developers"]);
  });
});
