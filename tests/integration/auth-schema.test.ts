import { createAuthClient } from "better-auth/client";
import { symmetricDecrypt } from "better-auth/crypto";
import { and, eq, like } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { auth } from "@/features/auth/auth";
import { signInFlow, socialSignInFlow } from "@/features/auth/auth-flows";
import { createWorkspace } from "@/features/auth/organization/create-workspace";
import { verifiedAddress } from "@/features/auth/verification";
import { changePasswordFlow } from "@/features/settings/account-flows";
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
  const BASE_URL = "http://localhost:3088";
  vi.stubEnv("BETTER_AUTH_URL", BASE_URL);
  return { sendMail: vi.fn().mockResolvedValue({}), BASE_URL };
});
vi.mock("@/features/email/transporter", () => ({
  transporter: { sendMail },
  hasSmtpConfig: true,
}));
// What the flows of the forms ask of the navigation of next-intl, which is replaced ({R}): a
// stand-in builds a path the way it does, with the locale in front
vi.mock("@/shared/lib/i18n-navigation", () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
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

    // The forgot-password form's call, through the real handler: the link comes back to the
    // reset page of the language it was asked in (here English; the form builds the path with
    // the locale, see auth-flows.test.ts). The client captures the global fetch when its module
    // loads: stub it first, import the module after.
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      request.headers.set("origin", BASE_URL);
      return auth.handler(request);
    });
    const { requestPasswordReset } = await import("@/features/auth/auth-client");
    const requested = await requestPasswordReset({ email, redirectTo: "/en/reset-password" });
    expect(requested.error).toBeNull();

    // The e-mailed link validates the token and sends the browser on with it.
    const link = linkSentTo(email, /reset-password\//);
    const followed = await auth.handler(new Request(link));
    expect(followed.status).toBe(302);
    const callback = new URL(followed.headers.get("location") ?? "");
    expect(callback.pathname).toBe("/en/reset-password");
    const token = callback.searchParams.get("token") ?? "";
    expect(token).not.toBe("");

    expect((await http("POST", "/reset-password", { body: { newPassword, token } })).status).toBe(200);
    // The token is single-use.
    expect((await http("POST", "/reset-password", { body: { newPassword, token } })).status).toBe(400);
    // The link is dead once it has been used: it sends the browser on with an error, no token.
    const reused = new URL((await auth.handler(new Request(link))).headers.get("location") ?? "");
    expect(reused.pathname).toBe("/en/reset-password");
    expect(reused.searchParams.get("error")).toBe("INVALID_TOKEN");
    expect(reused.searchParams.has("token")).toBe(false);

    await expect(auth.api.signInEmail({ body: { email, password: PASSWORD } })).rejects.toMatchObject({ statusCode: 401 });
    const { headers } = await auth.api.signInEmail({ body: { email, password: newPassword }, returnHeaders: true });
    expect(cookieFrom(headers)).toContain("session_token");
  });

  // What the reset page tells a dead link by: `?error=INVALID_TOKEN` and no token.
  it("sends the browser on with an error when the e-mailed link was never good", async () => {
    const callbackURL = encodeURIComponent("/fr/reset-password");
    const followed = await auth.handler(new Request(`${BASE_URL}/api/auth/reset-password/never-issued?callbackURL=${callbackURL}`));

    expect(followed.status).toBe(302);
    const callback = new URL(followed.headers.get("location") ?? "");
    expect(callback.pathname).toBe("/fr/reset-password");
    expect(callback.searchParams.get("error")).toBe("INVALID_TOKEN");
    expect(callback.searchParams.has("token")).toBe(false);
  });
});

/** Signs in with the password of `registerUser`, again: another session of the same person. */
async function signInAgain(email: string, password = PASSWORD) {
  const { headers } = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
  const cookie = cookieFrom(headers);

  return { cookie, headers: new Headers({ cookie }) };
}

/** An account that has not followed its verification link: the e-mail that was sent at sign-up is the last one. */
async function signUpUnverified(email: string, extraBody: Record<string, unknown> = {}) {
  const answer = await http("POST", "/sign-up/email", {
    body: { name: "Test Person", email, password: PASSWORD, ...extraBody },
  });
  expect(answer.status).toBe(200);

  return answer;
}

/** Where the browser is sent when it follows a link of an e-mail, and nothing is followed further. */
async function follow(link: string) {
  const answer = await auth.handler(new Request(link));
  expect(answer.status).toBe(302);

  return answer.headers.get("location") ?? "";
}

describe("email verification, which can be finished", () => {
  // An address that is not verified cannot sign in. The link of the e-mail sent at
  // sign-up expires, and with it the only way in: a person who comes back the next
  // day is told to open a link that no longer works, and nothing sends another.
  it("sends the link of sign-up back to the verify page of the language of the form, and the link works", async () => {
    const email = "verify-signup@example.com";
    await signUpUnverified(email, { callbackURL: "/fr/verify-email?verified=1" });

    const link = linkSentTo(email, /verify-email/);
    expect(new URL(link).searchParams.get("callbackURL")).toBe("/fr/verify-email?verified=1");

    expect(await follow(link)).toBe("/fr/verify-email?verified=1");
    const [verified] = await testDb.select().from(user).where(eq(user.email, email));
    expect(verified.emailVerified).toBe(true);
  });

  // The server refuses, and sends nothing: its link could not say where it comes back to (a
  // sign-in does not say where the person came from). The form sends the link, below.
  it("refuses an address that is not verified when it signs in with the right password, and sends nothing itself", async () => {
    const email = "verify-signin@example.com";
    await signUpUnverified(email);
    sendMail.mockClear();

    const refused = await http("POST", "/sign-in/email", { body: { email, password: PASSWORD } });

    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { code: string }).code).toBe("EMAIL_NOT_VERIFIED");
    expect(sendMail).not.toHaveBeenCalled();
  });

  // The client of the browser, against the real server: the form's flows are given it, and it
  // reports the answers as the real one does. A browser that holds a session (`cookie`) sends it
  // with every request, unless the call says `credentials: "omit"`.
  const browser = ({ cookie }: { cookie?: string } = {}) =>
    createAuthClient({
      baseURL: BASE_URL,
      fetchOptions: {
        customFetchImpl: (input, init) => {
          const request = new Request(input, init);
          request.headers.set("origin", BASE_URL);
          if (cookie && request.credentials !== "omit") {
            request.headers.set("cookie", cookie);
          }

          return auth.handler(request);
        },
      },
    });

  it("sends the link from the form, back to the verify page of the language and the page that sent the person, and the link works", async () => {
    const email = "verify-flow-way-back@example.com";
    await signUpUnverified(email);
    sendMail.mockClear();

    const told = await signInFlow(browser(), {
      email,
      password: PASSWORD,
      locale: "fr",
      callbackUrl: "/fr/accept-invitation/inv_1",
    });

    expect(told).toEqual({ ok: false, messageKey: "auth.errors.emailNotVerified" });
    // One link, the form's: the server's own is off
    expect(sendMail).toHaveBeenCalledTimes(1);
    const link = linkSentTo(email, /verify-email/);
    expect(new URL(link).searchParams.get("callbackURL")).toBe(
      "/fr/verify-email?verified=1&callbackUrl=%2Ffr%2Faccept-invitation%2Finv_1",
    );

    // The verify page it lands on hands the page to come back to on to the sign-in page
    expect(await follow(link)).toBe("/fr/verify-email?verified=1&callbackUrl=%2Ffr%2Faccept-invitation%2Finv_1");
    const [verified] = await testDb.select().from(user).where(eq(user.email, email));
    expect(verified.emailVerified).toBe(true);
    expect((await http("POST", "/sign-in/email", { body: { email, password: PASSWORD } })).status).toBe(200);
  });

  // The server refuses a request for the link of an address when the request holds the session of
  // another one (EMAIL_MISMATCH): a browser on which a person is still signed in sends it with
  // every request. The person who signs in now is not that session, and the link must leave.
  it("sends the link from a browser that still holds the session of another person, back to the page that sent the person", async () => {
    const other = await registerUser("verify-flow-session-other@example.com");
    const email = "verify-flow-session@example.com";
    await signUpUnverified(email);
    sendMail.mockClear();

    // With the session, the server would refuse: the same request, from the same browser
    const withTheSession = await auth.handler(new Request(`${BASE_URL}/api/auth/send-verification-email`, {
      method: "POST",
      headers: { origin: BASE_URL, "content-type": "application/json", cookie: other.cookie },
      body: JSON.stringify({ email, callbackURL: "/fr/verify-email?verified=1" }),
    }));
    expect(withTheSession.status).toBe(400);
    expect(((await withTheSession.json()) as { code: string }).code).toBe("EMAIL_MISMATCH");
    expect(sendMail).not.toHaveBeenCalled();

    const told = await signInFlow(browser({ cookie: other.cookie }), {
      email,
      password: PASSWORD,
      locale: "fr",
      callbackUrl: "/fr/accept-invitation/inv_1",
    });

    expect(told).toEqual({ ok: false, messageKey: "auth.errors.emailNotVerified" });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(new URL(linkSentTo(email, /verify-email/)).searchParams.get("callbackURL")).toBe(
      "/fr/verify-email?verified=1&callbackUrl=%2Ffr%2Faccept-invitation%2Finv_1",
    );
  });

  it("sends the link bare, to the verify page of the language, when the person came from no page", async () => {
    const email = "verify-flow-bare@example.com";
    await signUpUnverified(email);
    sendMail.mockClear();

    await signInFlow(browser(), { email, password: PASSWORD, locale: "en" });

    expect(new URL(linkSentTo(email, /verify-email/)).searchParams.get("callbackURL")).toBe("/en/verify-email?verified=1");
  });

  it("sends the link of sign-up and the link of sign-in to the same place for the same page", async () => {
    const email = "verify-flow-same@example.com";
    const callbackUrl = "/en/accept-invitation/inv_7";
    await signUpUnverified(email, { callbackURL: verifiedAddress("/en/verify-email", callbackUrl) });
    const fromSignUp = new URL(linkSentTo(email, /verify-email/)).searchParams.get("callbackURL");
    sendMail.mockClear();

    await signInFlow(browser(), { email, password: PASSWORD, locale: "en", callbackUrl });

    expect(new URL(linkSentTo(email, /verify-email/)).searchParams.get("callbackURL")).toBe(fromSignUp);
  });

  it("sends nothing to a person who does not know the password: the form asks only after the refusal that the password earns", async () => {
    const email = "verify-flow-stranger@example.com";
    await signUpUnverified(email);
    sendMail.mockClear();

    const told = await signInFlow(browser(), { email, password: "not-the-password", locale: "en" });

    expect(told).toEqual({ ok: false, messageKey: "auth.errors.invalidCredentials" });
    expect(sendMail).not.toHaveBeenCalled();
  });

  // The endpoint the form asks is open to anyone, and tells nothing of an address by what it says:
  // the status and the body of the answer for an address with no account, one that is verified and
  // one that is not are the same, and only the last is mailed. The time is not checked: Better Auth
  // holds every answer to a floor of 500 ms, and a mail that is slower than that goes past it.
  it("answers a request for a link with the same status and body for an address with no account, a verified one and one that is not, and mails only the last", async () => {
    const unverified = "verify-link-unverified@example.com";
    const verified = "verify-link-verified@example.com";
    await registerUser(verified);
    await signUpUnverified(unverified);
    sendMail.mockClear();

    const answers = [];
    for (const email of ["verify-link-nobody@example.com", verified, unverified]) {
      const answer = await http("POST", "/send-verification-email", { body: { email, callbackURL: "/en/verify-email?verified=1" } });
      answers.push([answer.status, await answer.json()]);
    }

    expect(answers).toEqual([
      [200, { status: true }],
      [200, { status: true }],
      [200, { status: true }],
    ]);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({ to: unverified });
  });

  // A request that says nothing of where the link comes back to (a client of the API) gets one that would
  // go to `/`, the marketing site, signed out: the link goes to the verify page
  it("lands the link of a request that gives no page on the verify page, not on the marketing site", async () => {
    const email = "verify-link-no-page@example.com";
    await signUpUnverified(email);
    sendMail.mockClear();

    expect((await http("POST", "/send-verification-email", { body: { email } })).status).toBe(200);

    const link = linkSentTo(email, /verify-email/);
    expect(new URL(link).searchParams.get("callbackURL")).toBe("/verify-email?verified=1");
    expect(await follow(link)).toBe("/verify-email?verified=1");
  });

  it("tells the form to say so: the refusal of the real server is the code the sign-in flow tells with its own message", async () => {
    const email = "verify-flow@example.com";
    await signUpUnverified(email);

    await expect(signInFlow(browser(), { email, password: PASSWORD, locale: "en" })).resolves.toEqual({
      ok: false,
      messageKey: "auth.errors.emailNotVerified",
    });
  });

  it("sends nothing to whoever does not know the password, and answers alike for an address that is unknown", async () => {
    const email = "verify-stranger@example.com";
    await signUpUnverified(email);
    sendMail.mockClear();

    const wrong = await http("POST", "/sign-in/email", { body: { email, password: "not-the-password" } });
    const unknown = await http("POST", "/sign-in/email", { body: { email: "nobody-here@example.com", password: "not-the-password" } });

    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect(((await wrong.json()) as { code: string }).code).toBe("INVALID_EMAIL_OR_PASSWORD");
    expect(((await unknown.json()) as { code: string }).code).toBe("INVALID_EMAIL_OR_PASSWORD");
    expect(sendMail).not.toHaveBeenCalled();
  });

  // Signing up again with an address that has an account answers as a new one does:
  // nothing tells whether the address is taken
  it("keeps the answer of sign-up the same for an address that is taken and for one that is not", async () => {
    const email = "verify-taken@example.com";
    const first = await http("POST", "/sign-up/email", { body: { name: "First", email, password: PASSWORD } });
    sendMail.mockClear();
    const again = await http("POST", "/sign-up/email", { body: { name: "Second", email, password: "another-long-passphrase" } });

    expect([first.status, again.status]).toEqual([200, 200]);
    const firstBody = (await first.json()) as { token: null; user: Record<string, unknown> };
    const againBody = (await again.json()) as { token: null; user: Record<string, unknown> };
    expect(againBody.token).toBeNull();
    expect(Object.keys(againBody.user).sort()).toEqual(Object.keys(firstBody.user).sort());
    expect(againBody.user.email).toBe(email);
    // Nothing is mailed for it, and no second account is made
    expect(sendMail).not.toHaveBeenCalled();
    expect(await testDb.select().from(user).where(eq(user.email, email))).toHaveLength(1);
  });

  it("sends a link that is dead to the verify page with the error, in the language it was asked in", async () => {
    const callbackURL = encodeURIComponent("/fr/verify-email?verified=1");
    const dead = await auth.handler(new Request(`${BASE_URL}/api/auth/verify-email?token=never-issued&callbackURL=${callbackURL}`));

    expect(dead.status).toBe(302);
    const where = new URL(dead.headers.get("location") ?? "", BASE_URL);
    expect(where.pathname).toBe("/fr/verify-email");
    expect(where.searchParams.get("error")).toBe("INVALID_TOKEN");
  });

  // The e-mail says "This link will expire in 24 hours" (templates/verify-email.tsx)
  it("keeps the link good for the 24 hours that the e-mail says", async () => {
    const early = "verify-early@example.com";
    const late = "verify-late@example.com";
    await signUpUnverified(early);
    await signUpUnverified(late);
    const earlyLink = linkSentTo(early, /verify-email/);
    const lateLink = linkSentTo(late, /verify-email/);

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + 23 * 3_600_000);
      expect(new URL(await follow(earlyLink), BASE_URL).searchParams.has("error")).toBe(false);

      vi.setSystemTime(Date.now() + 2 * 3_600_000);
      expect(new URL(await follow(lateLink), BASE_URL).searchParams.get("error")).toBe("TOKEN_EXPIRED");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("sessions end with the password", () => {
  // A password is reset or changed when someone else may have it: the session
  // they opened with it must not outlive it (a session is renewed each time it is used)
  it("ends every session of the person when the password is reset through the e-mailed link", async () => {
    const email = "reset-revokes@example.com";
    const newPassword = "another-long-passphrase";
    const first = await registerUser(email);
    const second = await signInAgain(email);
    expect((await auth.api.getSession({ headers: first.headers }))?.user.email).toBe(email);
    expect((await auth.api.getSession({ headers: second.headers }))?.user.email).toBe(email);

    expect((await http("POST", "/request-password-reset", { body: { email, redirectTo: "/en/reset-password" } })).status).toBe(200);
    const callback = new URL(await follow(linkSentTo(email, /reset-password\//)), BASE_URL);
    const token = callback.searchParams.get("token") ?? "";
    expect((await http("POST", "/reset-password", { body: { newPassword, token } })).status).toBe(200);

    expect(await auth.api.getSession({ headers: first.headers })).toBeNull();
    expect(await auth.api.getSession({ headers: second.headers })).toBeNull();
    // The new password signs in: nothing but the old sessions went
    expect((await signInAgain(email, newPassword)).cookie).toContain("session_token");
  });

  /** The client of the account page, answered by the real server for the session `as`: the cookie it was given back is kept. */
  function accountClient(as: Headers) {
    const state = { cookie: "" };
    const client = {
      changePassword: async (input: { currentPassword: string; newPassword: string; revokeOtherSessions: boolean }) => {
        try {
          const { headers } = await auth.api.changePassword({ headers: as, body: input, returnHeaders: true });
          state.cookie = cookieFrom(headers);

          return { error: null };
        } catch (error) {
          return { error };
        }
      },
    };

    return { client, state };
  }

  it("ends the other sessions of the person when the password is changed, and keeps the one in use", async () => {
    const email = "change-revokes@example.com";
    const newPassword = "another-long-passphrase";
    const inUse = await registerUser(email);
    const other = await signInAgain(email);
    const { client, state } = accountClient(inUse.headers);

    await expect(changePasswordFlow(client, { currentPassword: PASSWORD, newPassword })).resolves.toBe(true);

    expect(await auth.api.getSession({ headers: other.headers })).toBeNull();
    // The session in use goes on, under the token that the answer sets
    expect((await auth.api.getSession({ headers: new Headers({ cookie: state.cookie }) }))?.user.email).toBe(email);
    expect((await signInAgain(email, newPassword)).cookie).toContain("session_token");
  });

  it("would leave the other sessions open if the flow did not ask: the server only ends them on request", async () => {
    const email = "change-keeps@example.com";
    const inUse = await registerUser(email);
    const other = await signInAgain(email);

    await auth.api.changePassword({
      headers: inUse.headers,
      body: { currentPassword: PASSWORD, newPassword: "another-long-passphrase", revokeOtherSessions: false },
    });

    expect((await auth.api.getSession({ headers: other.headers }))?.user.email).toBe(email);
  });
});

describe("a provider that is cancelled or refuses", () => {
  // The provider is on when its keys are set when auth.ts loads, so this is a
  // copy of the server that has them
  async function serverWithGithub() {
    vi.resetModules();
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "test-client-secret");

    return (await import("@/features/auth/auth")).auth;
  }

  it("brings the person back to the sign-in page of their language, with the code of the provider", async () => {
    const social = await serverWithGithub();
    let started: { url: string; cookie: string } | undefined;
    // The social call of the form, answered by the real server
    const client = {
      signIn: {
        social: async (input: { provider: string; callbackURL: string; errorCallbackURL: string }) => {
          const answer = await social.handler(new Request(`${BASE_URL}/api/auth/sign-in/social`, {
            method: "POST",
            headers: { origin: BASE_URL, "content-type": "application/json" },
            body: JSON.stringify(input),
          }));
          if (!answer.ok) {
            return { error: (await answer.json()) as { code?: string } };
          }
          started = { url: ((await answer.json()) as { url: string }).url, cookie: cookieFrom(answer.headers) };

          return { error: null };
        },
      },
    };

    await expect(socialSignInFlow(client, { provider: "github", locale: "fr" })).resolves.toEqual({ ok: true });

    // The provider sends the browser back to the app with the error and the state it was given
    const state = new URL(started?.url ?? "").searchParams.get("state") ?? "";
    expect(state).not.toBe("");
    const refused = await social.handler(new Request(`${BASE_URL}/api/auth/callback/github?error=access_denied&state=${state}`, {
      headers: { cookie: started?.cookie ?? "" },
    }));

    expect(refused.status).toBe(302);
    const where = new URL(refused.headers.get("location") ?? "", BASE_URL);
    expect(where.origin + where.pathname).toBe(`${BASE_URL}/fr/sign-in`);
    expect(where.searchParams.get("error")).toBe("access_denied");
  });
});

describe("the name of a workspace, which the address of the workspace is made from", () => {
  /**
   * What the action `createOrganization` does for the person `as`, through the real
   * server: it answers `{ success }`, and a refusal carries the sentence of the server in
   * English, which nothing may show. `change` changes what is asked, to make the server refuse.
   */
  function creating(
    as: Headers,
    change: (input: { name: string; slug: string }) => { name: string; slug: string } = (input) => input,
  ) {
    return {
      create: async (input: { name: string; slug: string }) => {
        try {
          const created = await auth.api.createOrganization({ headers: as, body: change(input) });

          return { success: true as const, data: { id: created.id } };
        } catch {
          return { success: false as const, error: "Failed to create organization" };
        }
      },
      switchTo: async () => true,
      refresh: () => {},
    };
  }

  async function slugsLike(prefix: string): Promise<string[]> {
    const rows = await testDb.select({ slug: organization.slug }).from(organization).where(like(organization.slug, `${prefix}-%`));

    return rows.map(({ slug }) => slug);
  }

  // Onboarding asked for a slug, made from the name, with nothing to tell two of them apart:
  // the second "Acme" was refused, with the English sentence of the server in a toast
  it("lets two people call their workspace Acme: each gets an address of its own", async () => {
    const first = await registerUser("acme-one@example.com");
    const second = await registerUser("acme-two@example.com");

    await expect(createWorkspace(creating(first.headers), "Acme Studio")).resolves.toBe(true);
    await expect(createWorkspace(creating(second.headers), "Acme Studio")).resolves.toBe(true);

    const slugs = await slugsLike("acme-studio");
    expect(slugs).toHaveLength(2);
    expect(new Set(slugs).size).toBe(2);
    for (const slug of slugs) {
      expect(slug).toMatch(/^acme-studio-[a-z0-9]{6}$/);
    }
  });

  it("answers an address that is taken with a refusal, never an exception or the sentence of the server, and the next try goes through", async () => {
    const first = await registerUser("taken-one@example.com");
    const second = await registerUser("taken-two@example.com");
    await createWorkspace(creating(first.headers), "Taken Name");
    const [taken = ""] = await slugsLike("taken-name");
    expect(taken).not.toBe("");

    // The address that was made is the one that exists: the server says no
    const refused = createWorkspace(creating(second.headers, (input) => ({ ...input, slug: taken })), "Taken Name");

    await expect(refused).resolves.toBe(false);
    await expect(createWorkspace(creating(second.headers), "Taken Name")).resolves.toBe(true);
    expect(await slugsLike("taken-name")).toHaveLength(2);
  });
});
