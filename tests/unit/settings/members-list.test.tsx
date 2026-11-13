import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeRole, leaveWorkspace, removeMember, transferOwnership } from "@/features/auth/organization/actions";
import { MembersList, removeMemberInput } from "@/features/auth/organization/components/members-list";
import { RoleBadge } from "@/features/auth/organization/components/role-badge";
import { toast } from "@/shared/components/ui/sonner";
import { groups, reset, rows } from "../../helpers/fake-dropdown-menu";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  tagSaying,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// What the list reaches for outside itself, replaced: the menu of a row (Radix
// draws it in a portal, which a static render leaves out: the stand-in draws
// each part in place and keeps what choosing a row does), the router, the
// toasts, the server actions, and the confirm dialog, whose props are what a
// row decides to ask. What Radix does with them (opening, focus) is the work of
// the stories.
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const confirm = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[] }));

vi.mock("@/shared/components/ui/dropdown-menu", () => import("../../helpers/fake-dropdown-menu"));
vi.mock("@/shared/lib/i18n-navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/settings/team",
}));
vi.mock("@/shared/components/ui/sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/components/ui/sonner")>()),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/features/auth/organization/actions", () => ({
  changeRole: vi.fn(),
  leaveWorkspace: vi.fn(),
  removeMember: vi.fn(),
  transferOwnership: vi.fn(),
}));
vi.mock("@/shared/components/ui/confirm-dialog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/components/ui/confirm-dialog")>()),
  ConfirmDialog: (props: Record<string, unknown>) => {
    confirm.calls.push(props);
    return null;
  },
}));

const ORG = "org_1";
/** The id of the title of the card the page puts the list in. */
const TITLE_ID = "members-title";

function member(id: string, userId: string, name: string, role: string, image: string | null = null) {
  return { id, userId, role, userName: name, userEmail: `${userId}@example.com`, userImage: image };
}

// Four people, whose ids differ on purpose: the id of a membership (m3) is not
// the id of the person (u3), and the server removes by the first.
const OLIVIA = member("m1", "u1", "Olivia Owen", "owner");
const ADAM = member("m2", "u2", "Adam Dupont", "admin");
const MIA = member("m3", "u3", "Mia Martin", "member");
const ADA = member("m4", "u4", "Ada Lopez", "admin");
const MEMBERS = [OLIVIA, ADAM, MIA, ADA];

const AS_OWNER = { userId: "u1", role: "owner" } as const;
const AS_ADMIN = { userId: "u2", role: "admin" } as const;
const AS_MEMBER = { userId: "u3", role: "member" } as const;

type Locale = "en" | "fr";

function render(props: Partial<ComponentProps<typeof MembersList>> = {}, locale: Locale = "en"): string {
  reset();
  confirm.calls.length = 0;
  return renderWithIntl(
    <MembersList orgId={ORG} members={MEMBERS} viewer={AS_OWNER} labelledBy={TITLE_ID} {...props} />,
    locale,
  );
}

/** The names that have a menu: each one is the label of the button that opens it. */
function menusOf(html: string): string[] {
  return startTags(html, "button")
    .map((tag) => attribute(tag, "aria-label"))
    .filter((label) => label !== undefined);
}

/** The group of radio rows of the menu of this member: the one that holds the roles. */
function roleGroupOf(position: number) {
  const group = groups[position];
  expect(group, `the menu of the row ${position}`).toBeDefined();
  return group;
}

/** The confirm dialog of the row that asks about this person. */
function confirmFor(name: string) {
  const call = confirm.calls.find(({ title }) => typeof title === "string" && title.includes(name));
  expect(call, `a confirmation about ${name}`).toBeDefined();
  return call as { onConfirm: () => Promise<void>; [key: string]: unknown };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(changeRole).mockResolvedValue({ success: true, data: undefined });
  vi.mocked(removeMember).mockResolvedValue({ success: true, data: undefined });
  vi.mocked(leaveWorkspace).mockResolvedValue({ success: true, data: undefined });
  vi.mocked(transferOwnership).mockResolvedValue({ success: true, data: undefined });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("removeMemberInput", () => {
  it("removes a member by membership id", () => {
    expect(removeMemberInput("org", { id: "m1", userId: "u1" })).toEqual({ orgId: "org", memberIdToRemove: "m1" });
  });
});

describe("the members of a workspace", () => {
  it("is a list with one row per member, in the order they come", () => {
    const html = render();
    const rowsHtml = elements(html, "li");

    expect(html).toContain('role="list"');
    expect(rowsHtml).toHaveLength(4);
    expect(rowsHtml.map((row) => textOf(row))).toEqual([
      expect.stringContaining("Olivia Owen"),
      expect.stringContaining("Adam Dupont"),
      expect.stringContaining("Mia Martin"),
      expect.stringContaining("Ada Lopez"),
    ]);
  });

  // The name itself (a screen reader says "Members, list, 4 items") is the work of the
  // stories, which have a browser to compute it, and of the Team page's test, which
  // checks that the title carries this id.
  it("is named by the title of its card: the list points at it by the id the page gives", () => {
    const [list = ""] = startTags(render({ labelledBy: "title-of-the-card" }), "ul");

    expect(attribute(list, "role")).toBe("list");
    expect(attribute(list, "aria-labelledby")).toBe("title-of-the-card");
  });

  it("shows each member as an avatar, the name, the email in the line under it, and the role", () => {
    const [first = ""] = elements(render(), "li");

    expect(first).toContain('data-slot="initial-tile"');
    expect(textOf(first)).toContain("OO");
    expect(textOf(first)).toContain("Olivia Owen");
    expect(textOf(first)).toContain("u1@example.com");
    expect(textOf(first)).toContain("Owner");
    // The name comes before the email, which is the meta line
    expect(textOf(first).indexOf("Olivia Owen")).toBeLessThan(textOf(first).indexOf("u1@example.com"));
  });

  it("gives a member with a photo the photo, and the initials until it loads", () => {
    const html = render({ members: [member("m9", "u9", "Zoé Bernard", "member", "https://example.com/zoe.png")] });

    // The photo is drawn by the browser once it is loaded: the server draws the initials in its place
    expect(html).toContain('data-slot="initial-tile"');
    expect(textOf(html)).toContain("ZB");
  });

  it("is an empty list with nothing to draw when there is nobody", () => {
    expect(elements(render({ members: [] }), "li")).toEqual([]);
  });

  it("speaks French", () => {
    const html = render({}, "fr");

    expect(textOf(html)).toContain("Propriétaire");
    expect(textOf(html)).toContain("Administrateur");
    expect(textOf(html)).toContain("Membre");
    expect(menusOf(html)[0]).toBe("Actions pour Adam Dupont");
  });
});

describe("who is offered the actions of a member", () => {
  it("is the owner, for every member but themselves", () => {
    expect(menusOf(render({ viewer: AS_OWNER }))).toEqual([
      "Actions for Adam Dupont",
      "Actions for Mia Martin",
      "Actions for Ada Lopez",
    ]);
  });

  it("is an admin, for every member but the owner, and for themselves to leave", () => {
    expect(menusOf(render({ viewer: AS_ADMIN }))).toEqual(["Actions for Adam Dupont", "Actions for Mia Martin", "Actions for Ada Lopez"]);
  });

  it("is not a plain member, for anyone else: their own row offers to leave, and nothing more", () => {
    const html = render({ viewer: AS_MEMBER });

    expect(menusOf(html)).toEqual(["Actions for Mia Martin"]);
    expect(groups).toEqual([]);
    expect(rows.map(({ label }) => label)).toEqual(["Leave workspace"]);
    expect(confirm.calls.map(({ title }) => title)).toEqual(["Leave this workspace?"]);
  });

  it("is never offered for the owner, whoever looks", () => {
    for (const viewer of [AS_OWNER, AS_ADMIN, AS_MEMBER]) {
      expect(menusOf(render({ viewer })), viewer.role).not.toContain("Actions for Olivia Owen");
    }
  });

  // Leaving is the one thing a person does to their own row: a role is not changed, and nobody is removed, from there
  it("offers yourself only the way to leave, even when you are an admin", () => {
    render({ viewer: AS_ADMIN });

    expect(groups.map(({ value }) => value)).toEqual(["member", "admin"]);
    expect(rows.map(({ label }) => label)).toEqual(["Leave workspace", "Remove from workspace", "Remove from workspace"]);
  });

  it("keeps the room of a menu in the rows that have none, when others have one, so that the roles line up", () => {
    const spacers = (html: string) =>
      elements(html, "li").map((row) => startTags(row, "span").filter((tag) => decodedClassesOf(tag).includes("size-10")).length);

    // The owner is the first row: no menu for them (nor for themselves), room kept for it
    expect(spacers(render({ viewer: AS_OWNER }))).toEqual([1, 0, 0, 0]);
    expect(spacers(render({ viewer: AS_ADMIN }))).toEqual([1, 0, 0, 0]);
    // A plain member has a menu on their own row only: the others keep its room
    expect(spacers(render({ viewer: AS_MEMBER }))).toEqual([1, 1, 0, 1]);
    // The owner alone in the workspace: no menu anywhere, and no empty room
    expect(spacers(render({ viewer: AS_OWNER, members: [OLIVIA] }))).toEqual([0]);
  });

  it("makes every menu button a 44 px control that says it opens a menu", () => {
    const html = render();
    const [trigger = ""] = startTags(html, "button");

    expect(decodedClassesOf(trigger)).toContain("tap-target");
    expect(attribute(trigger, "type")).toBe("button");
  });
});

describe("the menu of a member", () => {
  it("offers the two roles a member can be given, with the current one chosen, and a way to remove", () => {
    render({ viewer: AS_OWNER });

    // One menu for each of Adam, Mia and Ada, in the order of the list
    expect(groups.map(({ value }) => value)).toEqual(["admin", "member", "admin"]);
    expect(groups.map(({ items }) => items)).toEqual(Array.from({ length: 3 }, () => ["admin", "member"]));
    // The owner may also hand the workspace over: that row comes before the one that removes
    expect(rows.map(({ label }) => label)).toEqual(Array.from({ length: 3 }, () => ["Make owner", "Remove from workspace"]).flat());
  });

  it("offers no way to hand over to an admin, who is not the owner", () => {
    render({ viewer: AS_ADMIN });

    expect(rows.map(({ label }) => label)).not.toContain("Make owner");
  });

  it("changes the role by the id of the membership, then reads the page again", async () => {
    render({ viewer: AS_OWNER });

    roleGroupOf(1)?.onValueChange("admin"); // Mia

    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(changeRole).toHaveBeenCalledExactlyOnceWith({ orgId: ORG, memberId: "m3", newRole: "admin" });
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Role updated.");
  });

  // The second call waits for the first, whoever makes it: the guard is read at once (a ref), not from the
  // render that the call was made in (a state), so that two calls in the same turn do not both pass it.
  it("asks the server once for a role that is being changed, however many times it is chosen", async () => {
    let answer: (value: { success: true; data: undefined }) => void = () => {};
    vi.mocked(changeRole).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render({ viewer: AS_OWNER });

    roleGroupOf(1)?.onValueChange("admin");
    roleGroupOf(1)?.onValueChange("admin");
    roleGroupOf(1)?.onValueChange("admin");
    expect(changeRole).toHaveBeenCalledOnce();

    answer({ success: true, data: undefined });
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    // Once it is over, the next change goes through
    roleGroupOf(1)?.onValueChange("admin");
    expect(changeRole).toHaveBeenCalledTimes(2);
  });

  it("does nothing when the role chosen is the one the member has", () => {
    render({ viewer: AS_OWNER });

    roleGroupOf(1)?.onValueChange("member");

    expect(changeRole).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("says so, and does not read the page again, when the server refuses the new role", async () => {
    vi.mocked(changeRole).mockResolvedValue({ success: false, error: "Failed to change role" });
    render({ viewer: AS_OWNER });

    roleGroupOf(1)?.onValueChange("admin");

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
    expect(toast.error).toHaveBeenCalledWith("We couldn't update this member. Please try again.");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("says so, and tells the error reporter, when the call fails outright", async () => {
    const reported = vi.fn();
    vi.stubGlobal("reportError", reported);
    vi.mocked(changeRole).mockRejectedValue(new Error("offline"));
    render({ viewer: AS_OWNER });

    roleGroupOf(1)?.onValueChange("admin");

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
    expect(reported).toHaveBeenCalledOnce();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("removing a member", () => {
  it("asks first, in the danger tone, naming the person, with nothing to type and a button that says what it does", () => {
    render({ viewer: AS_OWNER });
    const dialog = confirmFor("Mia Martin");

    expect(dialog).toMatchObject({
      open: false,
      tone: "danger",
      title: "Remove Mia Martin?",
      confirmLabel: "Remove",
    });
    expect(dialog.requireText).toBeUndefined();
    expect(String(dialog.description)).toContain("lose access");
    expect(typeof dialog.onCloseAutoFocus).toBe("function");
  });

  it("asks once for each member who can be removed, and for nobody else", () => {
    render({ viewer: AS_ADMIN });

    expect(confirm.calls.map(({ title }) => title).filter((title) => String(title).startsWith("Remove"))).toEqual([
      "Remove Mia Martin?",
      "Remove Ada Lopez?",
    ]);
  });

  it("removes by the id of the membership, never by the id of the person", async () => {
    render({ viewer: AS_OWNER });

    await confirmFor("Mia Martin").onConfirm();

    expect(removeMember).toHaveBeenCalledExactlyOnceWith({ orgId: ORG, memberIdToRemove: "m3" });
  });

  it("says who was removed and reads the page again once the server has done it", async () => {
    render({ viewer: AS_OWNER });

    await confirmFor("Mia Martin").onConfirm();

    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Mia Martin was removed.");
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("rejects when the server refuses, so that the dialog stays open with its error and nothing looks removed", async () => {
    vi.mocked(removeMember).mockResolvedValue({ success: false, error: "Failed to remove member" });
    render({ viewer: AS_OWNER });

    await expect(confirmFor("Mia Martin").onConfirm()).rejects.toThrow("Failed to remove member");

    expect(toast.success).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("rejects when the call fails outright, for the same reason", async () => {
    vi.mocked(removeMember).mockRejectedValue(new Error("offline"));
    render({ viewer: AS_OWNER });

    await expect(confirmFor("Mia Martin").onConfirm()).rejects.toThrow("offline");

    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("asks in French", () => {
    render({ viewer: AS_OWNER }, "fr");

    expect(confirmFor("Mia Martin")).toMatchObject({
      title: "Retirer Mia Martin ?",
      confirmLabel: "Retirer",
    });
  });
});

describe("handing the workspace over", () => {
  const handOverFor = (name: string) => {
    const call = confirm.calls.find(({ title }) => typeof title === "string" && title.includes(name) && title.includes("owner"));
    expect(call, `a hand-over confirmation about ${name}`).toBeDefined();

    return call as { onConfirm: () => Promise<void>; [key: string]: unknown };
  };

  it("asks first, naming the person, and says what each of the two becomes", () => {
    render({ viewer: AS_OWNER });

    expect(handOverFor("Mia Martin")).toMatchObject({
      title: "Make Mia Martin the owner?",
      description: expect.stringContaining("you become an admin"),
      confirmLabel: "Make owner",
    });
    // A hand-over is not undone by the person who made it, but it is not a deletion: no danger tone
    expect(handOverFor("Mia Martin").tone).toBeUndefined();
  });

  it("asks once for each member the owner can hand over to, and for nobody else", () => {
    render({ viewer: AS_OWNER });

    expect(confirm.calls.map(({ title }) => String(title)).filter((title) => title.endsWith("the owner?"))).toEqual([
      "Make Adam Dupont the owner?",
      "Make Mia Martin the owner?",
      "Make Ada Lopez the owner?",
    ]);
  });

  it.each([["an admin", AS_ADMIN], ["a member", AS_MEMBER]])("asks nothing of %s", (_, viewer) => {
    render({ viewer });

    expect(confirm.calls.map(({ title }) => String(title)).filter((title) => title.endsWith("the owner?"))).toEqual([]);
  });

  it("hands over by the id of the membership, says who is the owner now and reads the page again", async () => {
    render({ viewer: AS_OWNER });

    await handOverFor("Mia Martin").onConfirm();

    expect(transferOwnership).toHaveBeenCalledExactlyOnceWith({ orgId: ORG, memberId: "m3" });
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Mia Martin is now the owner.");
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("rejects when the server refuses, so that the dialog stays open and nothing looks changed", async () => {
    vi.mocked(transferOwnership).mockResolvedValue({ success: false, error: "Failed to hand the workspace over" });
    render({ viewer: AS_OWNER });

    await expect(handOverFor("Mia Martin").onConfirm()).rejects.toThrow("Failed to hand the workspace over");

    expect(router.refresh).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("asks in French", () => {
    render({ viewer: AS_OWNER }, "fr");

    expect(confirm.calls.map(({ title }) => title)).toContain("Nommer Mia Martin propriétaire ?");
    expect(rows.map(({ label }) => label)).toContain("Nommer propriétaire");
  });
});

describe("leaving the workspace", () => {
  /** The confirmation of the person's own row. */
  const leaveDialog = () => {
    const call = confirm.calls.find(({ title }) => title === "Leave this workspace?");
    expect(call, "the confirmation of leaving").toBeDefined();
    return call as { onConfirm: () => Promise<void>; [key: string]: unknown };
  };

  it("is offered to everyone but the owner, on their own row, who deletes the workspace instead", () => {
    render({ viewer: AS_OWNER });
    expect(rows.map(({ label }) => label)).not.toContain("Leave workspace");

    for (const viewer of [AS_ADMIN, AS_MEMBER]) {
      render({ viewer });
      expect(rows.filter(({ label }) => label === "Leave workspace"), viewer.role).toHaveLength(1);
    }
  });

  it("asks first, in the danger tone, with a button that says what it does", () => {
    render({ viewer: AS_MEMBER });

    expect(leaveDialog()).toMatchObject({ open: false, tone: "danger", confirmLabel: "Leave" });
    expect(String(leaveDialog().description)).toContain("invite you again");
    expect(leaveDialog().requireText).toBeUndefined();
  });

  it("leaves the workspace of the page, then goes to the home, which opens the next workspace or onboarding", async () => {
    render({ viewer: AS_MEMBER });

    await leaveDialog().onConfirm();

    expect(leaveWorkspace).toHaveBeenCalledExactlyOnceWith({ orgId: ORG });
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("You left the workspace.");
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/dashboard");
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("rejects when the server refuses, so that the dialog stays open with its error and the person stays", async () => {
    vi.mocked(leaveWorkspace).mockResolvedValue({ success: false, error: "Failed to leave the workspace" });
    render({ viewer: AS_MEMBER });

    await expect(leaveDialog().onConfirm()).rejects.toThrow("Failed to leave the workspace");

    expect(toast.success).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("asks in French", () => {
    render({ viewer: AS_MEMBER }, "fr");

    expect(confirm.calls.find(({ title }) => title === "Quitter cet espace ?")).toMatchObject({ confirmLabel: "Quitter" });
    expect(rows.map(({ label }) => label)).toEqual(["Quitter l'espace"]);
  });
});

describe("the role badge", () => {
  const badge = (role: string, locale: Locale = "en") => renderWithIntl(<RoleBadge role={role} />, locale);

  it("says the role in words, in the language of the page", () => {
    expect(textOf(badge("owner"))).toBe("Owner");
    expect(textOf(badge("admin"))).toBe("Admin");
    expect(textOf(badge("member"))).toBe("Member");
    expect(textOf(badge("owner", "fr"))).toBe("Propriétaire");
    expect(textOf(badge("admin", "fr"))).toBe("Administrateur");
    expect(textOf(badge("member", "fr"))).toBe("Membre");
  });

  it("is neutral for the owner and the admin: no accent, as the role is not the point of the page", () => {
    for (const role of ["owner", "admin"]) {
      const classes = decodedClassesOf(startTags(badge(role), "span")[0] ?? "");

      expect(classes, role).toContain("bg-secondary");
      expect(classes, role).not.toContain("bg-brand");
    }
  });

  it("is an outline for a member, the quietest of the three", () => {
    const classes = decodedClassesOf(startTags(badge("member"), "span")[0] ?? "");

    expect(classes).toContain("border-border");
    expect(classes.some((name) => name.startsWith("bg-"))).toBe(false);
  });

  it("stays small, as every badge: 12 px text", () => {
    expect(decodedClassesOf(startTags(badge("admin"), "span")[0] ?? "")).toContain("text-caption");
  });

  it("is an outline for a role it does not know, rather than a word of its own", () => {
    expect(decodedClassesOf(startTags(badge("guest"), "span")[0] ?? "")).toContain("border-border");
  });

  it("is a badge, not a button: it is drawn beside the menu and takes no click", () => {
    expect(tagSaying(badge("admin"), "span", "Admin")).toContain('data-slot="badge"');
  });
});
