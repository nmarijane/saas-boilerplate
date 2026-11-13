import type { ComponentProps } from "react";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import AcceptInvitationPage from "@/app/[locale]/(auth)/(center)/accept-invitation/[invitationId]/page";
import { auth } from "@/features/auth/auth";
import { acceptInvitation, declineInvitation, inviteMember } from "@/features/auth/organization/actions";
import { invitation, organizationMember } from "@/models";
import { linksSentTo, registerUser } from "../helpers/auth-instance";
import { attribute, elements, startTags, textOf } from "../helpers/html";
import { renderWithIntl } from "../helpers/intl";
import { redirectOf } from "../helpers/navigation";
import { testDb } from "../setup";

/**
 * An invitation, end to end, against the real Better Auth instance and the
 * migrated test database: the e-mail an admin sends, the page its link opens
 * (in each of its states) and the answer of the person, through the server
 * actions that call Better Auth with the session's headers. The routes of
 * Better Auth that write an organization stay closed over HTTP
 * (auth-schema.test.ts). Only the mail transport is mocked, so the real
 * template is rendered and its link is the one that is followed; the session of
 * a request is the browser of the person the test acts as.
 */

const { sendMail, BASE_URL } = vi.hoisted(() => {
  // A configured app has an absolute base URL (see .env.example); it is read when auth.ts loads.
  const BASE_URL = "http://localhost:3088";
  vi.stubEnv("BETTER_AUTH_URL", BASE_URL);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", BASE_URL);
  return { sendMail: vi.fn().mockResolvedValue({}), BASE_URL };
});
vi.mock("@/features/email/transporter", () => ({
  transporter: { sendMail },
  hasSmtpConfig: true,
}));
vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
// What these cases are about is the e-mail, not the plan: the limits of the plans have their own tests (plan-limits.test.ts)
vi.mock("@/features/plan-limits", () => ({ assertWithinPlan: vi.fn(), assertFreeWorkspaceRoom: vi.fn() }));
// The translator of the server, built from the message files: the words are the real ones, and a message that is missing throws
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: en } = await import("@/locales/en.json");
  const { default: fr } = await import("@/locales/fr.json");
  const messages = { en, fr };

  return {
    // The language of the request: the guard puts it in front of the page it sends to
    getLocale: async () => "en",
    getTranslations: async (options: { locale: "en" | "fr"; namespace?: string }) =>
      createTranslator({
        locale: options.locale,
        messages: messages[options.locale],
        namespace: options.namespace as "invitation",
        onError: (error) => {
          throw error;
        },
      }),
  };
});
// The navigation of next-intl: a link is a plain anchor, and the redirect throws as the real one does
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  const { localizedRedirect } = await import("../helpers/navigation");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }),
    redirect: localizedRedirect,
    useRouter: () => ({ push: () => {}, refresh: () => {} }),
  };
});
vi.mock("@/features/auth/auth-client", () => ({ authClient: {} }));

afterAll(() => {
  vi.unstubAllEnvs();
});

/** The requests that follow are made by this person's browser (or by a visitor with no session). */
function actAs(person: { headers: Headers } | null) {
  vi.mocked(headers).mockResolvedValue(person ? person.headers : new Headers());
}

/** A workspace, Acme, whose owner Camille invites `email` as a member, from a page in `locale`. */
async function invited(prefix: string, email: string, locale: "en" | "fr" = "en") {
  const owner = await registerUser(sendMail, `${prefix}-owner@example.com`, "Camille Laurent");
  const workspace = await auth.api.createOrganization({
    headers: owner.headers,
    body: { name: "Acme", slug: `${prefix}-acme` },
  });
  actAs(owner);
  const sent = await inviteMember({ orgId: workspace.id, email, role: "member", locale });
  if (!sent.success) throw new Error(sent.error);

  return { owner, workspace, invitationId: sent.data.id };
}

async function page(invitationId: string, locale: "en" | "fr" = "en") {
  return renderWithIntl(await AcceptInvitationPage({ params: Promise.resolve({ locale, invitationId }) }), locale);
}

const h1Of = (html: string) => elements(html, "h1").map(textOf);
const buttonsOf = (html: string) => elements(html, "button").map(textOf);
const linksOf = (html: string) => startTags(html, "a").map((tag) => attribute(tag, "href"));

async function membershipOf(userId: string, organizationId: string) {
  const [row] = await testDb
    .select({ role: organizationMember.role })
    .from(organizationMember)
    .where(and(eq(organizationMember.userId, userId), eq(organizationMember.organizationId, organizationId)));
  return row ?? null;
}

async function statusOf(invitationId: string) {
  const [row] = await testDb.select({ status: invitation.status }).from(invitation).where(eq(invitation.id, invitationId));
  return row?.status;
}

beforeEach(() => {
  sendMail.mockClear();
  actAs(null);
});

describe("the invitation e-mail", () => {
  it("links to the page of the invitation, in the language of the person who invites, and names the workspace", async () => {
    const { invitationId, workspace } = await invited("mail-fr", "mail-fr-guest@example.com", "fr");
    const [mail] = sendMail.mock.calls.map(([message]) => message as { to: string; subject: string; html: string; text: string })
      .filter(({ to }) => to === "mail-fr-guest@example.com");

    expect(linksSentTo(sendMail, "mail-fr-guest@example.com")).toContain(`${BASE_URL}/fr/accept-invitation/${invitationId}`);
    expect(mail?.subject).toContain("Acme");
    expect(mail?.text).toContain("Acme");
    expect(mail?.text).toContain("Camille Laurent");
    expect(mail?.text).not.toContain(workspace.id);
  });

  it("links in English from an English page", async () => {
    const { invitationId } = await invited("mail-en", "mail-en-guest@example.com", "en");

    expect(linksSentTo(sendMail, "mail-en-guest@example.com")).toContain(`${BASE_URL}/en/accept-invitation/${invitationId}`);
  });

  it("tells the truth about how long the invitation lasts: the 7 days the e-mail says", async () => {
    const { invitationId } = await invited("mail-days", "mail-days-guest@example.com");
    const [row] = await testDb.select({ expiresAt: invitation.expiresAt }).from(invitation).where(eq(invitation.id, invitationId));
    const days = ((row?.expiresAt.getTime() ?? 0) - Date.now()) / (24 * 60 * 60 * 1000);

    expect(textOf(sendMail.mock.calls.at(-1)?.[0].html ?? "")).toContain("7 days");
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
  });
});

describe("the invitation page", () => {
  it("explains to a visitor who is not signed in, and offers to sign in or to sign up, coming back here afterwards", async () => {
    const { invitationId } = await invited("out", "out-guest@example.com");
    actAs(null);
    const html = await page(invitationId);
    const back = encodeURIComponent(`/en/accept-invitation/${invitationId}`);

    expect(h1Of(html)).toEqual(["You've been invited"]);
    expect(linksOf(html)).toEqual(expect.arrayContaining([`/sign-in?callbackUrl=${back}`, `/sign-up?callbackUrl=${back}`]));
    // The workspace and the address are for the person who signs in with it
    expect(textOf(html)).not.toContain("Acme");
    expect(textOf(html)).not.toContain("out-guest@example.com");
  });

  it("shows the workspace and who invited them to the person signed in with the invited address, with Accept and Decline", async () => {
    const { invitationId } = await invited("in", "in-guest@example.com");
    actAs(await registerUser(sendMail, "in-guest@example.com", "Léa Martin"));
    const html = await page(invitationId);

    expect(h1Of(html)).toEqual(["Join Acme"]);
    expect(textOf(html)).toContain("Camille Laurent invited you to join Acme as a member.");
    expect(buttonsOf(html)).toEqual(["Accept", "Decline"]);
  });

  it("says which address was invited to a person signed in with another, and offers to switch accounts", async () => {
    const { invitationId } = await invited("other", "other-guest@example.com");
    actAs(await registerUser(sendMail, "other-tom@example.com", "Tom Becker"));
    const html = await page(invitationId);

    expect(h1Of(html)).toEqual(["This invitation is for another address"]);
    expect(textOf(html)).toContain("other-guest@example.com");
    expect(textOf(html)).toContain("other-tom@example.com");
    expect(textOf(html)).not.toContain("Acme");
    expect(buttonsOf(html)).toEqual(["Switch account"]);
  });

  it("is a dead link, whoever looks, when the invitation expired, was cancelled or does not exist", async () => {
    const { invitationId } = await invited("dead", "dead-guest@example.com");
    const guest = await registerUser(sendMail, "dead-guest@example.com");
    const dead = async (id: string, person: { headers: Headers } | null) => {
      actAs(person);
      const html = await page(id);
      expect(buttonsOf(html), id).toEqual([]);
      expect(linksOf(html), id).toEqual(["/dashboard"]);
      return h1Of(html);
    };

    expect(await dead("no-such-invitation", guest)).toEqual(["This invitation no longer works"]);
    expect(await dead("no-such-invitation", null)).toEqual(["This invitation no longer works"]);

    await testDb.update(invitation).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitation.id, invitationId));
    expect(await dead(invitationId, guest)).toEqual(["This invitation no longer works"]);
    expect(await dead(invitationId, null)).toEqual(["This invitation no longer works"]);

    await testDb.update(invitation).set({ expiresAt: new Date(Date.now() + 60_000), status: "canceled" }).where(eq(invitation.id, invitationId));
    expect(await dead(invitationId, guest)).toEqual(["This invitation no longer works"]);
  });

  it("speaks French", async () => {
    const { invitationId } = await invited("fr", "fr-guest@example.com", "fr");
    actAs(await registerUser(sendMail, "fr-guest@example.com", "Léa Martin"));
    const html = await page(invitationId, "fr");

    expect(h1Of(html)).toEqual(["Rejoindre Acme"]);
    expect(textOf(html)).toContain("Camille Laurent vous invite à rejoindre Acme en tant que membre.");
    expect(buttonsOf(html)).toEqual(["Accepter", "Refuser"]);

    actAs(null);
    expect(h1Of(await page(invitationId, "fr"))).toEqual(["Une invitation vous attend"]);
  });

  it("speaks French to an invited admin, with the elision", async () => {
    const owner = await registerUser(sendMail, "fr-admin-owner@example.com", "Camille Laurent");
    const workspace = await auth.api.createOrganization({ headers: owner.headers, body: { name: "Acme", slug: "fr-admin-acme" } });
    actAs(owner);
    const sent = await inviteMember({ orgId: workspace.id, email: "fr-admin-guest@example.com", role: "admin", locale: "fr" });
    if (!sent.success) throw new Error(sent.error);
    actAs(await registerUser(sendMail, "fr-admin-guest@example.com", "Léa Martin"));

    expect(textOf(await page(sent.data.id, "fr"))).toContain("Camille Laurent vous invite à rejoindre Acme en tant qu'administrateur.");
    expect(textOf(await page(sent.data.id, "en"))).toContain("Camille Laurent invited you to join Acme as an admin.");
  });
});

describe("answering an invitation", () => {
  it("joins the workspace and makes it the active one, when the invited person accepts", async () => {
    const { invitationId, workspace } = await invited("accept", "accept-guest@example.com");
    const guest = await registerUser(sendMail, "accept-guest@example.com", "Léa Martin");
    actAs(guest);

    const answer = await acceptInvitation({ invitationId });

    expect(answer).toEqual({ success: true, data: { organizationId: workspace.id } });
    expect(await membershipOf(guest.id, workspace.id)).toEqual({ role: "member" });
    expect((await auth.api.getSession({ headers: guest.headers }))?.session.activeOrganizationId).toBe(workspace.id);
    expect(await statusOf(invitationId)).toBe("accepted");
  });

  it("declines it, and the person joins nothing", async () => {
    const { invitationId, workspace } = await invited("decline", "decline-guest@example.com");
    const guest = await registerUser(sendMail, "decline-guest@example.com");
    actAs(guest);

    expect(await declineInvitation({ invitationId })).toEqual({ success: true, data: undefined });
    expect(await membershipOf(guest.id, workspace.id)).toBeNull();
    expect(await statusOf(invitationId)).toBe("rejected");
  });

  it("refuses a person signed in with another address: the invitation stays theirs", async () => {
    const { invitationId, workspace } = await invited("thief", "thief-guest@example.com");
    const tom = await registerUser(sendMail, "thief-tom@example.com");
    actAs(tom);

    expect((await acceptInvitation({ invitationId })).success).toBe(false);
    expect((await declineInvitation({ invitationId })).success).toBe(false);

    expect(await membershipOf(tom.id, workspace.id)).toBeNull();
    expect(await statusOf(invitationId)).toBe("pending");
  });

  it("refuses an invitation that expired", async () => {
    const { invitationId, workspace } = await invited("late", "late-guest@example.com");
    const guest = await registerUser(sendMail, "late-guest@example.com");
    await testDb.update(invitation).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitation.id, invitationId));
    actAs(guest);

    expect((await acceptInvitation({ invitationId })).success).toBe(false);
    expect(await membershipOf(guest.id, workspace.id)).toBeNull();
  });

  it("sends a visitor with no session to sign in", async () => {
    const { invitationId } = await invited("anonymous", "anonymous-guest@example.com");
    actAs(null);

    expect(await redirectOf(acceptInvitation({ invitationId }))).toBe("/en/sign-in");
    expect(await redirectOf(declineInvitation({ invitationId }))).toBe("/en/sign-in");
    expect(await statusOf(invitationId)).toBe("pending");
  });
});
