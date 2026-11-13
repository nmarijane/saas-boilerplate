import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InviteButton } from "@/features/auth/organization/components/invite-button";
import { InviteFormView } from "@/features/auth/organization/components/invite-modal";
import { inviteMemberFlow } from "@/features/auth/organization/invite-member";
import { Dialog } from "@/shared/components/ui/dialog";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  tagSaying,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

// The dialog calls the server action, which is replaced: nothing here reaches
// the database. The toast is a stand-in too (it raises no toast in Node).
vi.mock("@/features/auth/organization/actions", () => ({
  inviteMember: vi.fn(),
}));
vi.mock("@/shared/components/ui/sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/components/ui/sonner")>()),
  toast: { success: vi.fn(), error: vi.fn() },
}));

type Locale = "en" | "fr";

describe("the invitation, once the person has asked for it", () => {
  const invite = vi.fn();
  const notify = vi.fn();
  const reported = vi.fn();
  const input: { orgId: string; email: string; role: "admin" | "member"; locale: Locale } = {
    orgId: "org_1",
    email: "  mia@example.com ",
    role: "member",
    locale: "fr",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    invite.mockResolvedValue({ success: true, data: { id: "invite-1" } });
    vi.stubGlobal("reportError", reported);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const flow = (override: Partial<typeof input> = {}) =>
    inviteMemberFlow({ invite, notify }, { ...input, ...override });

  // The language of the page is the one the link of the e-mail opens the invitation in
  it("sends the address without its spaces, with the role, the workspace and the language of the page, then says so", async () => {
    await expect(flow()).resolves.toBe("invited");

    expect(invite).toHaveBeenCalledExactlyOnceWith({ orgId: "org_1", email: "mia@example.com", role: "member", locale: "fr" });
    expect(notify).toHaveBeenCalledExactlyOnceWith("mia@example.com");
    expect(invite.mock.invocationCallOrder[0]).toBeLessThan(notify.mock.invocationCallOrder[0] ?? 0);
  });

  it("sends the role that was chosen", async () => {
    await flow({ role: "admin" });

    expect(invite).toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }));
  });

  it("says the address is not one, and sends nothing, when it is not an address", async () => {
    for (const email of ["mia", "mia@", "@example.com", "mia example.com", "mia@example", "a@b@c.com"]) {
      await expect(flow({ email }), email).resolves.toBe("invalid");
    }

    expect(invite).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("fails when the server refuses, and says nothing", async () => {
    invite.mockResolvedValue({ success: false, error: "Failed to invite member" });

    await expect(flow()).resolves.toBe("failed");

    expect(notify).not.toHaveBeenCalled();
  });

  it("fails, and tells the error reporter, when the call does not come back", async () => {
    invite.mockRejectedValue(new Error("offline"));

    await expect(flow()).resolves.toBe("failed");

    expect(reported).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "offline" }));
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("the form of the invitation", () => {
  // The form lives in a dialog: its header and its Cancel button need the
  // context of one, which an open `Dialog` gives without drawing a portal.
  function render(props: Partial<ComponentProps<typeof InviteFormView>> = {}, locale: Locale = "en") {
    return renderWithIntl(
      <Dialog open>
        <InviteFormView
          email=""
          role="member"
          pending={false}
          invalid={false}
          failed={false}
          onEmailChange={() => {}}
          onRoleChange={() => {}}
          onSubmit={() => {}}
          {...props}
        />
      </Dialog>,
      locale,
    );
  }

  const submitOf = (html: string) =>
    startTags(html, "button").find((tag) => attribute(tag, "type") === "submit") ?? "";

  it("is a form that checks the address itself, not the browser: its bubble speaks the language of the browser", () => {
    const [form = ""] = startTags(render(), "form");

    expect(attribute(form, "noValidate")).toBe("");
  });

  it("asks for an email, marked as required, and for a role, both labelled", () => {
    const html = render({ email: "mia@example.com" });
    const [email = ""] = startTags(html, "input");
    const [role = ""] = startTags(html, "button").filter((tag) => attribute(tag, "role") === "combobox");
    const labels = elements(html, "label");

    expect(textOf(labels[0] ?? "")).toBe("Email*");
    expect(textOf(labels[1] ?? "")).toBe("Role");
    expect(html).toContain(`for="${attribute(email, "id")}"`);
    expect(html).toContain(`for="${attribute(role, "id")}"`);
    expect(attribute(email, "type")).toBe("email");
    expect(attribute(email, "aria-required")).toBe("true");
    expect(decodedClassesOf(email)).toContain("min-h-11");
  });

  it("names the dialog and says what the person will receive", () => {
    const text = textOf(render());

    expect(text).toContain("Invite member");
    expect(text).toContain("They'll get an email with a link to join this workspace.");
  });

  it("waits for an address: Send is disabled while the field is empty or holds only spaces", () => {
    expect(attribute(submitOf(render({ email: "" })), "disabled")).toBe("");
    expect(attribute(submitOf(render({ email: "  " })), "disabled")).toBe("");
    expect(attribute(submitOf(render({ email: "mia@example.com" })), "disabled")).toBeUndefined();
    expect(textOf(elements(render({ email: "mia" }), "button").find((button) => /Send/.test(button)) ?? "")).toBe("Send invitation");
  });

  it("is a form whose Send submits it, and whose Cancel does not", () => {
    const html = render({ email: "mia@example.com" });

    expect(startTags(html, "form")).toHaveLength(1);
    expect(attribute(tagSaying(html, "button", "Cancel"), "type")).toBe("button");
  });

  it("shows no alert at rest", () => {
    expect(render({ email: "mia@example.com" })).not.toContain('role="alert"');
  });

  it("says under the field that the address is not one, as an alert tied to the field", () => {
    const html = render({ email: "mia", invalid: true });
    const [email = ""] = startTags(html, "input");

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(textOf(html)).toContain("Enter a valid email address.");
    expect(attribute(email, "aria-invalid")).toBe("true");
    expect(attribute(email, "aria-describedby")).toBe(`${attribute(email, "id")}-error`);
    expect(attribute(email, "value")).toBe("mia");
  });

  it("says that the invitation was not sent, in the dialog, and keeps what was typed", () => {
    const html = render({ email: "mia@example.com", failed: true });

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(textOf(html)).toContain("We couldn't send the invitation. Please try again.");
    expect(attribute(startTags(html, "input")[0] ?? "", "value")).toBe("mia@example.com");
  });

  it("holds the email read-only, not disabled, while it sends: a disabled field would drop the focus", () => {
    const html = render({ email: "mia@example.com", pending: true });
    const [email = ""] = startTags(html, "input");
    const send = submitOf(html);

    expect(attribute(email, "readOnly")).toBe("");
    expect(attribute(email, "disabled")).toBeUndefined();
    // Send keeps the focus and says it works (loading): it is not disabled. Cancel is held.
    expect(attribute(send, "aria-disabled")).toBe("true");
    expect(attribute(send, "data-loading")).toBe("");
    expect(attribute(send, "disabled")).toBeUndefined();
    expect(attribute(tagSaying(html, "button", "Cancel"), "disabled")).toBe("");
  });

  it("speaks French", () => {
    const html = render({ email: "mia@example.com", failed: true }, "fr");

    expect(textOf(html)).toContain("Inviter un membre");
    expect(textOf(html)).toContain("Rôle");
    expect(textOf(html)).toContain("Envoyer l'invitation");
    expect(textOf(html)).toContain("Impossible d'envoyer l'invitation. Veuillez réessayer.");
  });
});

describe("the button that invites", () => {
  const html = renderWithIntl(<InviteButton orgId="org_1" />);
  const [button = ""] = startTags(html, "button");

  it("is the one button, 44 px high, that says what it does", () => {
    expect(elements(html, "button")).toHaveLength(1);
    expect(textOf(elements(html, "button")[0] ?? "")).toBe("Invite member");
    expect(decodedClassesOf(button)).toContain("tap-target");
    expect(attribute(button, "type")).toBe("button");
  });

  it("says that it opens a dialog, which is closed, and draws none yet", () => {
    expect(attribute(button, "aria-haspopup")).toBe("dialog");
    expect(attribute(button, "aria-expanded")).toBe("false");
    expect(html).not.toContain('role="dialog"');
  });

  it("is the primary button: the invitation is the one main action of the Team page", () => {
    expect(decodedClassesOf(button)).toContain("bg-primary");
  });

  it("draws its icon as decoration", () => {
    expect(html).toContain('aria-hidden="true"');
    expect(renderWithIntl(<InviteButton orgId="org_1" />, "fr")).toContain("Inviter un membre");
  });
});

// `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere (the session is
// gone, the role is too low): the dialog must not keep what was typed and say "failed" for a person who is on their way
// to sign in, nor report it.
describe.each(FRAMEWORK_ERRORS)("%s from the server", (_, framework) => {
  it("is handed on by the dialog that invites a member: nothing is told", async () => {
    const reported = vi.fn();
    vi.stubGlobal("reportError", reported);
    const notify = vi.fn();

    const outcome = await outcomeOf(
      inviteMemberFlow({ invite: vi.fn().mockRejectedValue(framework), notify }, { orgId: "org_1", email: "mia@example.com", role: "member", locale: "en" }),
    );

    expect(outcome).toBe(framework);
    expect(notify).not.toHaveBeenCalled();
    expect(reported).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
