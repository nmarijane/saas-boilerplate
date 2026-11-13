import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/features/auth/auth";
import { leaveWorkspace } from "@/features/auth/organization/actions";
import { getWorkspaceContext } from "@/features/auth/organization/workspace";
import { organizationMember } from "@/models";
import { registerUser } from "../helpers/auth-instance";
import { redirectOf } from "../helpers/navigation";
import { testDb } from "../setup";

/**
 * Leaving a workspace, against the real Better Auth instance: the action is
 * guarded, refused to the owner (who deletes the workspace instead), and the
 * person who left works in their next workspace, or none. Only the mail
 * transport is mocked; the session of a request is the browser of the person
 * the test acts as.
 */

const { sendMail } = vi.hoisted(() => {
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3088");
  return { sendMail: vi.fn().mockResolvedValue({}) };
});
vi.mock("@/features/email/transporter", () => ({
  transporter: { sendMail },
  hasSmtpConfig: true,
}));
vi.mock("@/features/auth/guards", async (importOriginal) => importOriginal());
// The language of the request, which the guard puts in front of the page it sends to
vi.mock("next-intl/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl/server")>()),
  getLocale: async () => "en",
}));

afterAll(() => {
  vi.unstubAllEnvs();
});

function actAs(person: { headers: Headers } | null) {
  vi.mocked(headers).mockResolvedValue(person ? person.headers : new Headers());
}

/** Camille's workspace, which `member` joins as a member, and makes the active one. */
async function workspaceOf(prefix: string, name: string, member: { id: string; headers: Headers }) {
  const owner = await registerUser(sendMail, `${prefix}-owner@example.com`, "Camille Laurent");
  const workspace = await auth.api.createOrganization({
    headers: owner.headers,
    body: { name, slug: `${prefix}-${name.toLowerCase()}` },
  });
  await testDb.insert(organizationMember).values({
    id: `${prefix}-${member.id}`,
    organizationId: workspace.id,
    userId: member.id,
    role: "member",
    createdAt: new Date(),
  });
  await auth.api.setActiveOrganization({ headers: member.headers, body: { organizationId: workspace.id } });

  return { owner, workspace };
}

async function isMember(userId: string, organizationId: string) {
  const rows = await testDb
    .select({ id: organizationMember.id })
    .from(organizationMember)
    .where(and(eq(organizationMember.userId, userId), eq(organizationMember.organizationId, organizationId)));
  return rows.length > 0;
}

beforeEach(() => {
  actAs(null);
});

describe("leaving a workspace", () => {
  it("takes a member out of it, and they work in their next workspace", async () => {
    const tom = await registerUser(sendMail, "leave-tom@example.com", "Tom Becker");
    const { workspace: northwind } = await workspaceOf("leave-next", "Northwind", tom);
    const { workspace: acme } = await workspaceOf("leave", "Acme", tom);
    actAs(tom);

    expect(await leaveWorkspace({ orgId: acme.id })).toEqual({ success: true, data: undefined });

    expect(await isMember(tom.id, acme.id)).toBe(false);
    expect(await isMember(tom.id, northwind.id)).toBe(true);
    // The session no longer names the workspace that was left
    expect((await auth.api.getSession({ headers: tom.headers }))?.session.activeOrganizationId ?? null).toBeNull();
    expect((await getWorkspaceContext()).workspace?.id).toBe(northwind.id);
  });

  it("leaves a person who had one workspace with none: the home then sends them to onboarding", async () => {
    const tom = await registerUser(sendMail, "leave-only@example.com");
    const { workspace } = await workspaceOf("leave-only", "Acme", tom);
    actAs(tom);

    expect((await leaveWorkspace({ orgId: workspace.id })).success).toBe(true);

    expect((await getWorkspaceContext()).workspace).toBeNull();
  });

  it("refuses the owner, who deletes the workspace instead: it is never left without one", async () => {
    const tom = await registerUser(sendMail, "leave-owner-tom@example.com");
    const { owner, workspace } = await workspaceOf("leave-owner", "Acme", tom);
    actAs(owner);

    expect(await leaveWorkspace({ orgId: workspace.id })).toEqual({ success: false, error: "Failed to leave the workspace" });

    expect(await isMember(owner.id, workspace.id)).toBe(true);
  });

  // Better Auth lets an owner leave when another owner stays: the app never makes
  // two, but one more is all it takes (a person given the role by hand), and the
  // rule of the app is that the owner deletes the workspace instead
  it("refuses an owner even when another owner would stay, which Better Auth alone would allow", async () => {
    const tom = await registerUser(sendMail, "leave-two-owners-tom@example.com");
    const { owner, workspace } = await workspaceOf("leave-two-owners", "Acme", tom);
    await testDb.update(organizationMember).set({ role: "owner" }).where(eq(organizationMember.userId, tom.id));
    actAs(owner);

    expect((await leaveWorkspace({ orgId: workspace.id })).success).toBe(false);

    expect(await isMember(owner.id, workspace.id)).toBe(true);
  });

  it("sends a person who is not in the workspace home, and a visitor with no session to sign in", async () => {
    const tom = await registerUser(sendMail, "leave-stranger-tom@example.com");
    const stranger = await registerUser(sendMail, "leave-stranger@example.com");
    const { workspace } = await workspaceOf("leave-stranger", "Acme", tom);

    actAs(stranger);
    expect(await redirectOf(leaveWorkspace({ orgId: workspace.id }))).toBe("/en/dashboard");
    actAs(null);
    expect(await redirectOf(leaveWorkspace({ orgId: workspace.id }))).toBe("/en/sign-in");

    expect(await isMember(tom.id, workspace.id)).toBe(true);
  });
});
