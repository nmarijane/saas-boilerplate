import { symmetricDecrypt } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { auth } from "@/features/auth/auth";
import { invitation, organization, organizationMember, session, twoFactor, user } from "@/models";
import { testDb } from "../setup";

/**
 * The real Better Auth instance against the migrated test database.
 *
 * Since Better Auth 1.7, every request first checks that the Drizzle schema
 * holds everything the enabled plugins write, and fails with SCHEMA_MISMATCH
 * otherwise. A plugin added to src/features/auth/auth.ts needs its tables and
 * columns in src/models and a migration: this file fails until they exist, and
 * its flows prove the migrated database accepts what the plugins write.
 *
 * The same instance serves /api/auth/* to the browser, so the HTTP tests also
 * pin what a browser can and cannot do through it.
 *
 * Only the mail transport is mocked, so the real templates are rendered and
 * the real verification and reset links are followed.
 */

const { sendMail, BASE_URL } = vi.hoisted(() => {
  // A configured app has an absolute base URL (see .env.example); it is read when auth.ts loads.
  const BASE_URL = "http://localhost:3000";
  vi.stubEnv("BETTER_AUTH_URL", BASE_URL);
  return { sendMail: vi.fn().mockResolvedValue({}), BASE_URL };
});
vi.mock("@/features/email/transporter", () => ({
  transporter: { sendMail },
  hasSmtpConfig: true,
}));

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const PASSWORD = "correct-horse-battery";

/** The organization routes the server actions replace: closed to the browser. */
const ORGANIZATION_WRITES = [
  "/organization/create",
  "/organization/update",
  "/organization/delete",
  "/organization/invite-member",
  "/organization/cancel-invitation",
  "/organization/remove-member",
  "/organization/update-member-role",
  "/organization/accept-invitation",
  "/organization/reject-invitation",
  "/organization/leave",
];
/** Organization routes that are POST but write nothing, or that the browser needs. */
const ORGANIZATION_BROWSER_POSTS = [
  "/organization/set-active",
  "/organization/check-slug",
  "/organization/has-permission",
];

/** The first link of the last e-mail sent to `email` that matches `pattern`. */
function linkSentTo(email: string, pattern: RegExp): string {
  const message = sendMail.mock.calls
    .map(([mail]) => mail as { to: string; html: string })
    .findLast((mail) => mail.to === email);
  const hrefs = [...(message?.html.matchAll(/href="([^"]+)"/g) ?? [])].map(([, href]) => href.replaceAll("&amp;", "&"));
  const link = hrefs.find((href) => pattern.test(href));
  if (!link) throw new Error(`No ${pattern} link was e-mailed to ${email}`);
  return link;
}

/** The cookies a browser would send back after the given response. */
function cookieFrom(response: Headers): string {
  return response
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");
}

/** A request to the Better Auth handler, as the browser sends it. */
function http(method: "GET" | "POST", path: string, { body, cookie }: { body?: unknown; cookie?: string } = {}) {
  return auth.handler(new Request(`${BASE_URL}/api/auth${path}`, {
    method,
    headers: {
      origin: BASE_URL,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}

/** Sign up over HTTP (with any extra body fields), follow the verification link, sign in. */
async function registerUser(email: string, extraBody: Record<string, unknown> = {}) {
  const signUp = await http("POST", "/sign-up/email", {
    body: { name: "Test Person", email, password: PASSWORD, ...extraBody },
  });
  expect(signUp.status).toBe(200);
  const { user: created } = await signUp.json() as { user: { id: string } };
  const token = new URL(linkSentTo(email, /verify-email/)).searchParams.get("token") ?? "";
  await auth.api.verifyEmail({ query: { token } });
  const { headers } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  const cookie = cookieFrom(headers);
  return { id: created.id, cookie, headers: new Headers({ cookie }) };
}

describe("better auth against the drizzle schema", () => {
  it("accepts requests: the schema holds what the enabled plugins write", async () => {
    await expect(auth.api.getSession({ headers: new Headers() })).resolves.toBeNull();
  });

  it("signs a user up, verifies the email and signs in", async () => {
    const email = "sign-up@example.com";

    const { user: created } = await auth.api.signUpEmail({
      body: { name: "Test Person", email, password: PASSWORD },
    });
    const [pending] = await testDb.select().from(user).where(eq(user.id, created.id));
    expect(pending.emailVerified).toBe(false);

    const token = new URL(linkSentTo(email, /verify-email/)).searchParams.get("token") ?? "";
    await auth.api.verifyEmail({ query: { token } });
    const [verified] = await testDb.select().from(user).where(eq(user.id, created.id));
    expect(verified.emailVerified).toBe(true);

    const { headers } = await auth.api.signInEmail({
      body: { email, password: PASSWORD },
      returnHeaders: true,
    });
    const current = await auth.api.getSession({ headers: new Headers({ cookie: cookieFrom(headers) }) });
    expect(current?.user.id).toBe(created.id);
  });

  it("creates an organization and records its creator as the owner", async () => {
    const owner = await registerUser("owner@example.com");

    const created = await auth.api.createOrganization({
      headers: owner.headers,
      body: { name: "Acme", slug: "acme", metadata: { plan: "demo" } },
    });

    const [row] = await testDb.select().from(organization).where(eq(organization.id, created.id));
    expect(row.slug).toBe("acme");
    expect(JSON.parse(row.metadata ?? "null")).toEqual({ plan: "demo" });

    const members = await testDb
      .select()
      .from(organizationMember)
      .where(eq(organizationMember.organizationId, created.id));
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ userId: owner.id, role: "owner" });

    // Reads that join the member with its user go through the same mapping.
    const listed = await auth.api.listMembers({
      headers: owner.headers,
      query: { organizationId: created.id },
    });
    expect(listed.members.map((member) => [member.userId, member.role])).toEqual([[owner.id, "owner"]]);
  });

  it("invites a member, who then joins the organization", async () => {
    const inviter = await registerUser("inviter@example.com");
    const created = await auth.api.createOrganization({
      headers: inviter.headers,
      body: { name: "Invites", slug: "invites" },
    });

    const sent = await auth.api.createInvitation({
      headers: inviter.headers,
      body: { organizationId: created.id, email: "guest@example.com", role: "member" },
    });

    const [row] = await testDb.select().from(invitation).where(eq(invitation.organizationId, created.id));
    expect(row).toMatchObject({
      id: sent.id,
      email: "guest@example.com",
      role: "member",
      status: "pending",
      inviterId: inviter.id,
    });
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const guest = await registerUser("guest@example.com");
    await auth.api.acceptInvitation({ headers: guest.headers, body: { invitationId: sent.id } });

    const [joined] = await testDb
      .select()
      .from(organizationMember)
      .where(and(eq(organizationMember.organizationId, created.id), eq(organizationMember.userId, guest.id)));
    expect(joined.role).toBe("member");
    const [accepted] = await testDb.select().from(invitation).where(eq(invitation.id, sent.id));
    expect(accepted.status).toBe("accepted");
  });

  it("sets the active organization on the session", async () => {
    const person = await registerUser("switcher@example.com");
    const first = await auth.api.createOrganization({
      headers: person.headers,
      body: { name: "First", slug: "first" },
    });
    const second = await auth.api.createOrganization({
      headers: person.headers,
      body: { name: "Second", slug: "second" },
    });
    const current = await auth.api.getSession({ headers: person.headers });
    expect(current?.session.activeOrganizationId).toBe(second.id);

    await auth.api.setActiveOrganization({
      headers: person.headers,
      body: { organizationId: first.id },
    });

    const [row] = await testDb.select().from(session).where(eq(session.token, current?.session.token ?? ""));
    expect(row.activeOrganizationId).toBe(first.id);
    const after = await auth.api.getSession({ headers: person.headers });
    expect(after?.session.activeOrganizationId).toBe(first.id);

    // What the organization switcher reads: the active organization with its members.
    const full = await auth.api.getFullOrganization({ headers: person.headers });
    expect(full?.name).toBe("First");
    expect(full?.members.map((member) => member.userId)).toEqual([person.id]);
  });

  it("enables two-factor authentication", async () => {
    const person = await registerUser("two-factor@example.com");

    const enabled = await auth.api.enableTwoFactor({
      headers: person.headers,
      body: { password: PASSWORD },
    });
    expect(enabled).toMatchObject({ method: "totp", backupCodes: expect.arrayContaining([expect.any(String)]) });

    const [pending] = await testDb.select().from(twoFactor).where(eq(twoFactor.userId, person.id));
    expect(pending.verified).toBe(false);
    expect(pending.secret).not.toBe("");
    expect(pending.backupCodes).not.toBe("");

    // Prove the authenticator app is set up: answer with a code from the stored secret.
    const context = await auth.$context;
    const secret = await symmetricDecrypt({ key: context.secretConfig, data: pending.secret });
    const { code } = await auth.api.generateTOTP({ body: { secret } });
    await auth.api.verifyTOTP({ headers: person.headers, body: { code } });

    const [confirmed] = await testDb.select().from(twoFactor).where(eq(twoFactor.userId, person.id));
    expect(confirmed.verified).toBe(true);
    const [owner] = await testDb.select().from(user).where(eq(user.id, person.id));
    expect(owner.twoFactorEnabled).toBe(true);
  });

  it("never takes isAdmin from the request: requireAdmin trusts it", async () => {
    // Sign-up copies every declared user field found in the body, unless the field is not an input.
    const person = await registerUser("self-admin@example.com", { isAdmin: true });
    const [created] = await testDb.select().from(user).where(eq(user.id, person.id));
    expect(created.isAdmin).toBe(false);

    expect((await http("POST", "/update-user", { body: { isAdmin: true }, cookie: person.cookie })).status).toBe(400);
    // What the onboarding wizard sends is still accepted.
    expect((await http("POST", "/update-user", { body: { onboardingCompleted: true }, cookie: person.cookie })).status).toBe(200);

    const [updated] = await testDb.select().from(user).where(eq(user.id, person.id));
    expect(updated).toMatchObject({ isAdmin: false, onboardingCompleted: true });
    const current = await auth.api.getSession({ headers: person.headers });
    expect(current?.user).toMatchObject({ isAdmin: false });
  });

  it("keeps organization writes behind the server actions", async () => {
    const owner = await registerUser("http-owner@example.com");

    // The list is the plugin's write routes, not a guess: a route added by an upgrade fails here.
    const postRoutes = Object.values(auth.api)
      .filter((endpoint) => endpoint.path?.startsWith("/organization/") && [endpoint.options.method].flat().includes("POST"))
      .map((endpoint) => endpoint.path);
    expect(postRoutes.filter((path) => !ORGANIZATION_BROWSER_POSTS.includes(path)).sort()).toEqual([...ORGANIZATION_WRITES].sort());

    for (const path of ORGANIZATION_WRITES) {
      expect(`${path} ${(await http("POST", path, { body: {}, cookie: owner.cookie })).status}`).toBe(`${path} 404`);
    }
    // Spelling a closed path differently does not open it.
    for (const variant of ["/organization/create/", "/organization/./create", "/organization/create?x=1"]) {
      expect(`${variant} ${(await http("POST", variant, { body: {}, cookie: owner.cookie })).status}`).toBe(`${variant} 404`);
    }

    // What the server actions call is not an HTTP route, so it keeps working.
    const created = await auth.api.createOrganization({
      headers: owner.headers,
      body: { name: "Http", slug: "http-api" },
    });
    await auth.api.createInvitation({
      headers: owner.headers,
      body: { organizationId: created.id, email: "http-guest@example.com", role: "member" },
    });

    // What the browser uses stays served: the switcher and the active organization.
    const switched = await http("POST", "/organization/set-active", { body: { organizationId: created.id }, cookie: owner.cookie });
    expect(switched.status).toBe(200);
    expect((await http("GET", "/organization/get-full-organization", { cookie: owner.cookie })).status).toBe(200);
  });

  it("resets a forgotten password through the e-mailed link", async () => {
    const email = "forgot@example.com";
    const newPassword = "another-long-passphrase";
    await registerUser(email);

    // The forgot-password form's call, through the real handler. The client captures the
    // global fetch when its module loads: stub it first, import the module after.
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      request.headers.set("origin", BASE_URL);
      return auth.handler(request);
    });
    const { requestPasswordReset } = await import("@/features/auth/auth-client");
    const requested = await requestPasswordReset({ email, redirectTo: "/sign-in" });
    expect(requested.error).toBeNull();

    // The e-mailed link validates the token and sends the browser on with it.
    const followed = await auth.handler(new Request(linkSentTo(email, /reset-password\//)));
    expect(followed.status).toBe(302);
    const callback = new URL(followed.headers.get("location") ?? "");
    expect(callback.pathname).toBe("/sign-in");
    const token = callback.searchParams.get("token") ?? "";
    expect(token).not.toBe("");

    expect((await http("POST", "/reset-password", { body: { newPassword, token } })).status).toBe(200);
    // The token is single-use.
    expect((await http("POST", "/reset-password", { body: { newPassword, token } })).status).toBe(400);

    await expect(auth.api.signInEmail({ body: { email, password: PASSWORD } })).rejects.toMatchObject({ statusCode: 401 });
    const { headers } = await auth.api.signInEmail({ body: { email, password: newPassword }, returnHeaders: true });
    expect(cookieFrom(headers)).toContain("session_token");
  });
});
