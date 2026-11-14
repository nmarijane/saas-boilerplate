import { beforeEach, expect, it } from "vitest";
import { getAdminMetrics } from "@/features/admin/queries";
import { getCreditBalance, getUsageStats, periodOf } from "@/features/ai/queries";
import { aiConversation, aiCreditLedger, aiMessage, organization, organizationMember, subscription, user } from "@/models";
import { describeOnPostgres } from "../helpers/postgres";
import { seedOrg, seedPlan, seedSubscription, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * What a sum comes back as. PostgreSQL sends the SUM of an integer column as a bigint, which the driver hands over as
 * a string ("880"); PGlite hands over a number. A query that sums reads it as a number (`mapWith(Number)`), and these
 * tests are on PostgreSQL because that is the only place where a query that forgets it can be seen to.
 */

const ORG = "types-org";
const USER = "types-user";

beforeEach(async () => {
  await testDb.delete(subscription);
  await testDb.delete(aiCreditLedger);
  await testDb.delete(aiMessage);
  await testDb.delete(aiConversation);
  await testDb.delete(organizationMember);
  await testDb.delete(organization);
  await testDb.delete(user);
  await seedUser(USER);
  await seedOrg(ORG);
});

describeOnPostgres("the sums of the queries", () => {
  it("gives the credit balance as a number", async () => {
    await testDb.insert(aiCreditLedger).values([
      { id: "l1", organizationId: ORG, amount: 1000, reason: "plan_allocation", bucket: "allocation", period: periodOf() },
      { id: "l2", organizationId: ORG, amount: -120, reason: "usage", bucket: "allocation", period: periodOf() },
      { id: "l3", organizationId: ORG, amount: 500, reason: "credit_pack", bucket: "pack" },
      // Last month's allocation does not carry over
      { id: "l4", organizationId: ORG, amount: 9000, reason: "plan_allocation", bucket: "allocation", period: "2020-01" },
    ]);

    expect(await getCreditBalance(ORG)).toBe(1380);
    expect(await getCreditBalance("types-nobody")).toBe(0);
  });

  it("gives the monthly revenue of the platform as a number", async () => {
    await seedPlan("pro", { price: 1999 });
    await seedSubscription(ORG, { planId: "pro" });

    expect((await getAdminMetrics()).mrr).toBe(1999);
  });

  it("gives the usage of the assistant, by day, as numbers", async () => {
    await testDb.insert(aiConversation).values({ id: "c1", organizationId: ORG, userId: USER });
    await testDb.insert(aiMessage).values([
      { id: "m1", conversationId: "c1", role: "assistant", content: "a", creditsUsed: 3 },
      { id: "m2", conversationId: "c1", role: "assistant", content: "b", creditsUsed: 4 },
    ]);

    const [day] = await getUsageStats(ORG);
    expect(day?.messages).toBe(2);
    expect(day?.credits).toBe(7);
  });
});
