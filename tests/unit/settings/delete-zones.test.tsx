import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteOrganization } from "@/features/auth/organization/actions";
import { DeleteWorkspaceZone } from "@/features/auth/organization/components/delete-workspace-zone";
import { deleteAccount } from "@/features/settings/actions";
import { DeleteAccountZone } from "@/features/settings/components/delete-account-zone";
import { toast } from "@/shared/components/ui/sonner";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// What the zones reach for outside themselves, replaced: the router (no Next
// router runs in a test), the toasts, the server actions, and the confirm dialog,
// whose props are what a zone decides to ask. The dialog is drawn closed, as a
// static render leaves it, and its `onConfirm` is what is called here.
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const confirm = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[] }));

vi.mock("@/shared/lib/i18n-navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/settings/account",
}));
vi.mock("@/shared/components/ui/sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/components/ui/sonner")>()),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/features/settings/actions", () => ({
  updateProfile: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock("@/features/auth/organization/actions", () => ({
  deleteOrganization: vi.fn(),
}));
vi.mock("@/shared/components/ui/confirm-dialog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/components/ui/confirm-dialog")>()),
  ConfirmDialog: (props: Record<string, unknown>) => {
    confirm.calls.push(props);
    return null;
  },
}));

type Locale = "en" | "fr";

interface Asked {
  onConfirm: (password?: string) => Promise<void>;
  [key: string]: unknown;
}

/** What the zone asks the confirm dialog for: the props of its one dialog. */
function render(node: React.ReactNode, locale: Locale = "en"): { html: string; asked: Asked } {
  confirm.calls.length = 0;
  const html = renderWithIntl(node, locale);
  expect(confirm.calls, "one confirmation").toHaveLength(1);

  return { html, asked: confirm.calls[0] as Asked };
}

/** A promise that is settled by hand, so that a test decides when the server answers. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(deleteAccount).mockResolvedValue({ success: true, data: { deleted: true } });
  vi.mocked(deleteOrganization).mockResolvedValue({ success: true, data: { deleted: true } });
});

describe("the zone that deletes the account", () => {
  const zone = (locale: Locale = "en", needsPassword = false) => render(<DeleteAccountZone needsPassword={needsPassword} />, locale);

  it("is one sentence on the danger background and the one destructive button", () => {
    const { html } = zone();
    const [card = ""] = startTags(html, "div").filter((tag) => attribute(tag, "data-slot") === "card");
    const [button = ""] = startTags(html, "button");

    expect(elements(html, "button")).toHaveLength(1);
    expect(textOf(html)).toContain("Deleting your account is permanent.");
    expect(decodedClassesOf(card)).toEqual(expect.arrayContaining(["border-danger", "bg-danger-bg"]));
    expect(decodedClassesOf(button)).toContain("bg-destructive");
    expect(textOf(elements(html, "button")[0] ?? "")).toBe("Delete account");
  });

  it("says that the button opens a dialog, and that the sentence describes it", () => {
    const { html } = zone();
    const [button = ""] = startTags(html, "button");
    const [sentence = ""] = startTags(html, "p");

    expect(attribute(button, "aria-haspopup")).toBe("dialog");
    expect(attribute(button, "aria-expanded")).toBe("false");
    expect(attribute(button, "aria-describedby")).toBe(attribute(sentence, "id"));
    expect(attribute(button, "type")).toBe("button");
  });

  it("asks first, in the danger tone, for DELETE to be typed, in either language, and gives the focus back", () => {
    for (const locale of ["en", "fr"] as const) {
      const { asked } = zone(locale);

      expect(asked, locale).toMatchObject({ open: false, tone: "danger", requireText: "DELETE" });
      expect(typeof asked.onCloseAutoFocus, locale).toBe("function");
    }
    expect(zone("en").asked).toMatchObject({
      title: "Delete your account?",
      confirmLabel: "Delete account",
    });
    expect(zone("fr").asked).toMatchObject({
      title: "Supprimer votre compte ?",
      confirmLabel: "Supprimer le compte",
    });
  });

  it("deletes the account, says so, and goes to the sign-in page", async () => {
    await zone().asked.onConfirm();

    expect(deleteAccount).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Your account was deleted.");
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/sign-in");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  // The answer of the action carries this page rendered again for someone who is
  // no longer signed in: a navigation started at once replaces it before it shows.
  it("leaves the moment the server has answered, with nothing awaited in between", async () => {
    const answer = deferred<{ success: true; data: { deleted: true } }>();
    vi.mocked(deleteAccount).mockReturnValue(answer.promise);
    const { asked } = zone();

    const confirming = asked.onConfirm();
    expect(router.push).not.toHaveBeenCalled();
    answer.resolve({ success: true, data: { deleted: true } });
    // One turn of the microtask queue: the continuation after the answer has run
    await Promise.resolve();

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/sign-in");
    await confirming;
  });

  it("rejects when the server refuses, so that the dialog stays open with its error and the person stays", async () => {
    vi.mocked(deleteAccount).mockResolvedValue({ success: false, error: "Failed to delete account" });

    await expect(zone().asked.onConfirm()).rejects.toThrow("Failed to delete account");

    expect(router.push).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  // An account with a password asks for it again, and the server checks it
  it("asks for the password again when the account has one, and sends it", async () => {
    const { asked } = zone("en", true);

    expect(asked).toMatchObject({ passwordLabel: "Current password" });
    await asked.onConfirm("correct horse");

    expect(deleteAccount).toHaveBeenCalledExactlyOnceWith({ password: "correct horse" });
  });

  it("asks for no password when the account has none (it signs in through a provider), and sends none", async () => {
    const { asked } = zone("en", false);

    expect(asked.passwordLabel).toBeUndefined();
    await asked.onConfirm("");

    expect(deleteAccount).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it.each([
    [{ deleted: false, reason: "wrong-password" }, "That password is not right."],
    [{ deleted: false, reason: "recent-sign-in-required" }, "For your security, sign out and sign in again, then delete your account."],
    [{ deleted: false, reason: "workspace-has-members", workspace: "Acme" }, "You own Acme, which has other members. Hand it over first: on its Team page, open the menu of a member and choose Make owner. Or remove the other members."],
    [{ deleted: false, reason: "workspace-kept", messageKey: "billing.deleteWorkspaceFailed" }, "A workspace you own could not be cleaned up, so nothing was deleted. Try again, or delete it from its settings."],
  ] as const)("keeps the dialog open and says why when the server keeps the account: %j", async (outcome, message) => {
    vi.mocked(deleteAccount).mockResolvedValue({ success: true, data: outcome });

    await expect(zone().asked.onConfirm("x")).rejects.toThrow(outcome.reason);

    expect(toast.error).toHaveBeenCalledExactlyOnceWith(message);
    expect(router.push).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("rejects when the call fails outright, for the same reason", async () => {
    vi.mocked(deleteAccount).mockRejectedValue(new Error("offline"));

    await expect(zone().asked.onConfirm()).rejects.toThrow("offline");

    expect(router.push).not.toHaveBeenCalled();
  });

  it("speaks French", () => {
    const { html } = zone("fr");

    expect(textOf(html)).toContain("La suppression de votre compte est définitive.");
    expect(textOf(elements(html, "button")[0] ?? "")).toBe("Supprimer le compte");
  });
});

describe("the zone that deletes the workspace", () => {
  const ORG = "org_1";
  const NAME = "Studio Nord";
  const zone = (locale: Locale = "en", name = NAME) =>
    render(<DeleteWorkspaceZone orgId={ORG} name={name} />, locale);

  it("is one sentence on the danger background and the one destructive button", () => {
    const { html } = zone();
    const [card = ""] = startTags(html, "div").filter((tag) => attribute(tag, "data-slot") === "card");
    const [button = ""] = startTags(html, "button");

    expect(elements(html, "button")).toHaveLength(1);
    expect(textOf(html)).toContain("Deleting this workspace removes it");
    expect(decodedClassesOf(card)).toEqual(expect.arrayContaining(["border-danger", "bg-danger-bg"]));
    expect(decodedClassesOf(button)).toContain("bg-destructive");
    expect(textOf(elements(html, "button")[0] ?? "")).toBe("Delete workspace");
    expect(attribute(button, "aria-haspopup")).toBe("dialog");
    expect(attribute(button, "aria-describedby")).toBe(attribute(startTags(html, "p")[0] ?? "", "id"));
  });

  it("asks first, in the danger tone, for the name of the workspace to be typed, as it is written", () => {
    const { asked } = zone();

    expect(asked).toMatchObject({
      open: false,
      tone: "danger",
      requireText: "Studio Nord",
      title: "Delete this workspace?",
      confirmLabel: "Delete workspace",
    });
    expect(String(asked.description)).toContain("Studio Nord");
    expect(typeof asked.onCloseAutoFocus).toBe("function");
    // A name with capitals and spaces is asked for as it is, never folded
    expect(zone("en", "  Atelier  Sud ").asked.requireText).toBe("  Atelier  Sud ");
  });

  it("asks in French, for the same name", () => {
    expect(zone("fr").asked).toMatchObject({
      requireText: "Studio Nord",
      title: "Supprimer cet espace ?",
      confirmLabel: "Supprimer l'espace",
    });
  });

  it("deletes the workspace by its id, says so, goes to the home and reads the shell again", async () => {
    await zone().asked.onConfirm();

    expect(deleteOrganization).toHaveBeenCalledExactlyOnceWith({ orgId: ORG });
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Workspace deleted.");
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/dashboard");
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(router.push.mock.invocationCallOrder[0]).toBeLessThan(router.refresh.mock.invocationCallOrder[0] ?? 0);
  });

  it("leaves the moment the server has answered, with nothing awaited in between", async () => {
    const answer = deferred<{ success: true; data: { deleted: true } }>();
    vi.mocked(deleteOrganization).mockReturnValue(answer.promise);

    const confirming = zone().asked.onConfirm();
    expect(router.push).not.toHaveBeenCalled();
    answer.resolve({ success: true, data: { deleted: true } });
    await Promise.resolve();

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/dashboard");
    expect(router.refresh).toHaveBeenCalledOnce();
    await confirming;
  });

  it("rejects when the server refuses, so that the dialog stays open with its error and the workspace is still there", async () => {
    vi.mocked(deleteOrganization).mockResolvedValue({ success: false, error: "Failed to delete organization" });

    await expect(zone().asked.onConfirm()).rejects.toThrow("Failed to delete organization");

    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("rejects when the call fails outright, for the same reason", async () => {
    vi.mocked(deleteOrganization).mockRejectedValue(new Error("offline"));

    await expect(zone().asked.onConfirm()).rejects.toThrow("offline");

    expect(router.push).not.toHaveBeenCalled();
  });

  // A feature that holds something for the workspace cleans it up before the rows
  // go, and one that cannot (the subscription could not be cancelled) keeps the
  // workspace: the server says which, and the zone tells it, in the page's language
  it("says why the workspace was kept when a feature could not clean up, and stays", async () => {
    vi.mocked(deleteOrganization).mockResolvedValue({ success: true, data: { deleted: false, messageKey: "billing.deleteWorkspaceFailed", done: [] } });

    await zone().asked.onConfirm();

    expect(toast.error).toHaveBeenCalledExactlyOnceWith(
      "The subscription of this workspace could not be cancelled, so the workspace was kept. Try again in a moment.",
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("says it in French", async () => {
    vi.mocked(deleteOrganization).mockResolvedValue({ success: true, data: { deleted: false, messageKey: "billing.deleteWorkspaceFailed", done: [] } });

    await zone("fr").asked.onConfirm();

    expect(toast.error).toHaveBeenCalledExactlyOnceWith(
      "L'abonnement de cet espace n'a pas pu être résilié : l'espace est conservé. Réessayez dans un instant.",
    );
  });

  // The subscription went before the files failed: the workspace is kept, its subscription is not
  it("says what was already done when a later step kept the workspace, in both languages", async () => {
    vi.mocked(deleteOrganization).mockResolvedValue({
      success: true,
      data: { deleted: false, messageKey: "upload.deleteWorkspaceFailed", done: ["billing.subscriptionCancelled"] },
    });

    await zone().asked.onConfirm();
    expect(toast.error).toHaveBeenLastCalledWith(
      "The files of this workspace could not be deleted, so the workspace was kept. Try again in a moment. Its subscription has already been cancelled.",
    );

    await zone("fr").asked.onConfirm();
    expect(toast.error).toHaveBeenLastCalledWith(
      "Les fichiers de cet espace n'ont pas pu être supprimés : l'espace est conservé. Réessayez dans un instant. Son abonnement a déjà été résilié.",
    );
  });

  // What the zone and its confirmation promise is what the deletion does: the
  // workspace, everything in it, and its subscription, which is cancelled
  it("says that the subscription goes too, in both languages", () => {
    expect(textOf(zone().html)).toContain("cancels any subscription it has");
    expect(String(zone().asked.description)).toContain("any subscription it has is cancelled");
    expect(textOf(zone("fr").html)).toContain("résilie son abonnement s'il en a un");
    expect(String(zone("fr").asked.description)).toContain("son abonnement, s'il en a un, est résilié");
  });
});
