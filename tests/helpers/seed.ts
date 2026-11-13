import {
  apiKey,
  feedback,
  notification,
  organization,
  organizationMember,
  plan,
  project,
  subscription,
  upload,
  user,
  webhookEndpoint,
} from "@/models";
import { testDb } from "../setup";

export async function seedUser(id = "test-user-1", overrides = {}) {
  const values = {
    id,
    name: "Test User",
    email: `${id}@test.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  await testDb.insert(user).values(values).onConflictDoNothing();
  return values;
}

export async function seedOrg(id = "test-org-1", overrides = {}) {
  const values = {
    id,
    name: "Test Org",
    slug: `test-org-${id}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  await testDb.insert(organization).values(values).onConflictDoNothing();
  return values;
}

export async function seedOrgMember(
  userId = "test-user-1",
  orgId = "test-org-1",
  role: "owner" | "admin" | "member" = "owner",
) {
  const id = `member-${userId}-${orgId}`;
  await testDb
    .insert(organizationMember)
    .values({
      id,
      userId,
      organizationId: orgId,
      role,
      createdAt: new Date(),
    })
    .onConflictDoNothing();
  return { id, userId, organizationId: orgId, role };
}

export async function seedPlan(id = "pro", overrides = {}) {
  const values = {
    id,
    name: "Pro",
    price: 1999,
    createdAt: new Date(),
    ...overrides,
  };
  await testDb.insert(plan).values(values).onConflictDoNothing();
  return values;
}

export async function seedSubscription(orgId = "test-org-1", overrides = {}) {
  const id = `sub-${orgId}`;
  const values = {
    id,
    organizationId: orgId,
    stripeCustomerId: "cus_test",
    stripeSubscriptionId: "sub_test",
    status: "active",
    planId: "pro",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  await testDb.insert(subscription).values(values).onConflictDoNothing();
  return values;
}

export async function seedNotification(
  userId = "test-user-1",
  overrides = {},
) {
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const values = {
    id,
    userId,
    title: "Test Notification",
    body: "This is a test notification",
    read: false,
    type: "info",
    createdAt: new Date(),
    ...overrides,
  };
  await testDb.insert(notification).values(values).onConflictDoNothing();
  return values;
}

export async function seedFeedback(userId = "test-user-1", overrides = {}) {
  const id = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const values = {
    id,
    userId,
    type: "bug",
    message: "Test feedback message",
    status: "new",
    createdAt: new Date(),
    ...overrides,
  };
  await testDb.insert(feedback).values(values).onConflictDoNothing();
  return values;
}

export async function seedUpload(userId = "test-user-1", overrides = {}) {
  const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const values = {
    id,
    userId,
    filename: "test.png",
    mimetype: "image/png",
    size: 1024,
    storageKey: `uploads/${id}`,
    createdAt: new Date(),
    ...overrides,
  };
  await testDb.insert(upload).values(values).onConflictDoNothing();
  return values;
}

export async function seedProject(orgId = "test-org-1", overrides = {}) {
  const id = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const values = {
    id,
    organizationId: orgId,
    name: "Test Project",
    status: "draft",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  await testDb.insert(project).values(values).onConflictDoNothing();
  return values;
}

export async function seedApiKey(orgId = "test-org-1", overrides = {}) {
  const id = `key-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const values = {
    id,
    orgId,
    createdBy: "test-user-1",
    name: "Test Key",
    prefix: "sk_live_abcd",
    hash: `hash-${id}`,
    scopes: ["*"],
    createdAt: new Date(),
    ...overrides,
  };
  await testDb.insert(apiKey).values(values).onConflictDoNothing();
  return values;
}

export async function seedWebhookEndpoint(orgId = "test-org-1", overrides = {}) {
  const id = `endpoint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const values = {
    id,
    orgId,
    url: "https://example.com/hook",
    secret: `whsec_${id}`,
    events: ["member.invited"],
    active: true,
    createdAt: new Date(),
    ...overrides,
  };
  await testDb.insert(webhookEndpoint).values(values).onConflictDoNothing();
  return values;
}
