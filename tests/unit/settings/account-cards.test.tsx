import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ActiveSessionsView } from "@/features/settings/components/active-sessions";
import { ChangePasswordFormView } from "@/features/settings/components/change-password-form";
import { ConnectedAccountsView } from "@/features/settings/components/connected-accounts";
import {
  isAvatarLink,
  ProfileFormView,
} from "@/features/settings/components/profile-form";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The cards of the account page call the auth client and a server action, which
// are replaced: nothing here reaches the network or the database. The router
// of next-intl is replaced (no Next router runs in a test).
vi.mock("@/features/settings/actions", () => ({
  updateProfile: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock("@/features/auth/auth-client", () => ({ authClient: {} }));
vi.mock("@/shared/lib/i18n-navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => "/settings/account",
}));

type Locale = "en" | "fr";

/** The id of the title of the card that holds a list, which the page gives the list to name it by. */
const TITLE_ID = "title-of-the-card";

/** The submit button of a form: the one whose label holds a spinner while it works, so it is found by its type. */
function submitOf(html: string): string {
  return startTags(html, "button").find((tag) => attribute(tag, "type") === "submit") ?? "";
}

/**
 * The start tag of the button that has this accessible name: its aria-label, or its
 * words. A button that works has a spinner before them, which says "Loading…".
 */
function buttonNamed(html: string, name: string): string {
  const tag = startTags(html, "button").find((candidate) => attribute(candidate, "aria-label") === name);
  if (tag) {
    return tag;
  }
  const label = elements(html, "button").find((button) => textOf(button).endsWith(name));
  return startTags(label ?? "", "button")[0] ?? "";
}

describe("the profile card", () => {
  const render = (props: Partial<ComponentProps<typeof ProfileFormView>> = {}, locale: Locale = "en") =>
    renderWithIntl(
      <ProfileFormView
        name="Camille Laurent"
        email="camille@example.com"
        image=""
        pending={false}
        saved={false}
        failed={false}
        imageInvalid={false}
        onNameChange={() => {}}
        onImageChange={() => {}}
        onSubmit={() => {}}
        {...props}
      />,
      locale,
    );

  it("labels the three fields, and marks the name, the only one that is required, as such", () => {
    const html = render();
    const [name = "", email = "", image = ""] = startTags(html, "input");
    const labels = elements(html, "label").map(textOf);

    expect(labels).toEqual(["Name*", "Email", "Avatar"]);
    expect(html).toContain(`for="${attribute(name, "id")}"`);
    expect(html).toContain(`for="${attribute(email, "id")}"`);
    expect(html).toContain(`for="${attribute(image, "id")}"`);
    expect(attribute(name, "aria-required")).toBe("true");
    expect(attribute(image, "aria-required")).toBeUndefined();
    for (const field of [name, email, image]) {
      expect(decodedClassesOf(field)).toContain("min-h-11");
    }
  });

  it("stops the name at what the server accepts, and gives the browser what it can fill in", () => {
    const [name = "", email = "", image = ""] = startTags(render(), "input");

    expect(attribute(name, "maxLength")).toBe("100");
    expect(attribute(name, "autoComplete")).toBe("name");
    expect(attribute(email, "autoComplete")).toBe("email");
    expect(attribute(image, "type")).toBe("url");
    expect(attribute(image, "placeholder")).toBe("https://example.com/avatar.png");
  });

  it("shows the email as it is, read-only rather than disabled, and says why it cannot be changed", () => {
    const html = render();
    const [, email = ""] = startTags(html, "input");

    expect(attribute(email, "value")).toBe("camille@example.com");
    expect(attribute(email, "readOnly")).toBe("");
    expect(attribute(email, "disabled")).toBeUndefined();
    // On a quiet tint, so that it does not look like a field to fill
    expect(decodedClassesOf(email)).toEqual(expect.arrayContaining(["bg-muted/50", "cursor-default"]));
    expect(attribute(email, "aria-describedby")).toBe(`${attribute(email, "id")}-hint`);
    expect(textOf(html)).toContain("You can't change your email here.");
  });

  it("waits for a name: Save is disabled while it is empty or holds only spaces", () => {
    expect(attribute(submitOf(render({ name: "" })), "disabled")).toBe("");
    expect(attribute(submitOf(render({ name: "  " })), "disabled")).toBe("");
    expect(attribute(submitOf(render()), "disabled")).toBeUndefined();
    expect(textOf(elements(render(), "button")[0] ?? "")).toBe("Save");
  });

  it("is a form that checks the link itself, not the browser", () => {
    expect(attribute(startTags(render(), "form")[0] ?? "", "noValidate")).toBe("");
  });

  it("shows nothing at rest: no alert, no status", () => {
    const html = render();

    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it("says that it saved, as a status next to the button", () => {
    const html = render({ saved: true });

    expect(textOf(elements(html, "span").find((span) => attribute(startTags(span, "span")[0] ?? "", "role") === "status") ?? "")).toBe("Saved");
    expect(html).not.toContain('role="alert"');
  });

  it("says that it did not, as an alert, and keeps what was typed", () => {
    const html = render({ name: "Camille", failed: true });

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(textOf(html)).toContain("We couldn't save your changes. Please try again.");
    expect(attribute(startTags(html, "input")[0] ?? "", "value")).toBe("Camille");
  });

  it("says under the link that it is not one, tied to the field, and keeps it", () => {
    const html = render({ image: "example.com/me.png", imageInvalid: true });
    const [, , image = ""] = startTags(html, "input");

    expect(textOf(html)).toContain("Enter a full link, such as https://example.com/me.png.");
    expect(attribute(image, "aria-invalid")).toBe("true");
    expect(attribute(image, "value")).toBe("example.com/me.png");
  });

  it("holds the fields read-only, not disabled, while it saves, and Save keeps the focus by loading", () => {
    const html = render({ pending: true });
    const [name = "", , image = ""] = startTags(html, "input");
    const save = submitOf(html);

    for (const field of [name, image]) {
      expect(attribute(field, "readOnly")).toBe("");
      expect(attribute(field, "disabled")).toBeUndefined();
    }
    expect(attribute(save, "aria-disabled")).toBe("true");
    expect(attribute(save, "data-loading")).toBe("");
    expect(attribute(save, "disabled")).toBeUndefined();
  });

  it("speaks French", () => {
    const html = render({ failed: true }, "fr");

    expect(elements(html, "label").map(textOf)).toEqual(["Nom*", "E-mail", "Avatar"]);
    expect(textOf(html)).toContain("Vous ne pouvez pas modifier votre e-mail ici.");
    expect(textOf(html)).toContain("Impossible d'enregistrer vos modifications. Veuillez réessayer.");
    expect(textOf(elements(html, "button")[0] ?? "")).toBe("Enregistrer");
  });
});

describe("what can be an avatar", () => {
  it("is an address on the web, http or https", () => {
    for (const link of ["https://example.com/me.png", "http://cdn.example.com/a/b.jpg?v=2", "HTTPS://EXAMPLE.COM/ME.PNG"]) {
      expect(isAvatarLink(link), link).toBe(true);
    }
  });

  it("is not a link with another scheme, a bare domain or a path", () => {
    for (const link of ["javascript:alert(1)", "data:image/png;base64,AAAA", "ftp://example.com/me.png", "example.com/me.png", "//example.com/me.png", "/me.png", "me", "https://", ""]) {
      expect(isAvatarLink(link), link).toBe(false);
    }
  });
});

describe("the password card", () => {
  const render = (props: Partial<ComponentProps<typeof ChangePasswordFormView>> = {}, locale: Locale = "en") =>
    renderWithIntl(
      <ChangePasswordFormView
        current=""
        next=""
        confirm=""
        pending={false}
        saved={false}
        failed={false}
        weak={false}
        mismatch={false}
        onCurrentChange={() => {}}
        onNextChange={() => {}}
        onConfirmChange={() => {}}
        onSubmit={() => {}}
        {...props}
      />,
      locale,
    );

  const FILLED = { current: "old-Secret-1", next: "New-Secret-123!", confirm: "New-Secret-123!" };

  it("labels the three passwords, all required, each with the autocomplete that tells a manager what it is", () => {
    const html = render();
    const inputs = startTags(html, "input");

    expect(elements(html, "label").map(textOf)).toEqual(["Current password*", "New password*", "Confirm new password*"]);
    expect(inputs.map((input) => attribute(input, "autoComplete"))).toEqual([
      "current-password",
      "new-password",
      "new-password",
    ]);
    for (const input of inputs) {
      expect(attribute(input, "aria-required")).toBe("true");
      expect(attribute(input, "type")).toBe("password");
      expect(decodedClassesOf(input)).toContain("min-h-11");
      expect(html).toContain(`for="${attribute(input, "id")}"`);
    }
  });

  it("waits for the three fields: Change is disabled until each has something", () => {
    const change = (props: Partial<ComponentProps<typeof ChangePasswordFormView>>) =>
      attribute(submitOf(render(props)), "disabled");

    expect(change({})).toBe("");
    expect(change({ current: "a", next: "b" })).toBe("");
    expect(change({ current: "a", confirm: "b" })).toBe("");
    expect(change({ next: "a", confirm: "b" })).toBe("");
    expect(change(FILLED)).toBeUndefined();
    expect(textOf(elements(render(FILLED), "button").at(-1) ?? "")).toBe("Change password");
  });

  it("tells the strength of the new password as it is typed, and nothing before", () => {
    expect(render()).not.toContain("<ul");
    expect(render({ next: "abc" })).toContain("<ul");
  });

  it("ties the list of rules to the new password, and to no other field, so that the rules are read with it", () => {
    const html = render(FILLED);
    const [current = "", next = "", confirm = ""] = startTags(html, "input");
    const [list = ""] = startTags(html, "ul");

    expect(attribute(list, "id")).toBeTruthy();
    expect(attribute(next, "aria-describedby")).toBe(attribute(list, "id"));
    expect(attribute(current, "aria-describedby")).toBeUndefined();
    expect(attribute(confirm, "aria-describedby")).toBeUndefined();
  });

  it("names no list while the new password is empty, and the rules and the error together once it is too weak", () => {
    const [, empty = ""] = startTags(render({ current: "a", confirm: "b" }), "input");
    expect(attribute(empty, "aria-describedby")).toBeUndefined();

    const html = render({ ...FILLED, next: "abc", weak: true });
    const [, next = ""] = startTags(html, "input");
    expect(attribute(next, "aria-describedby")).toBe(`${attribute(startTags(html, "ul")[0] ?? "", "id")} ${attribute(next, "id")}-error`);
  });

  it("says under the new password that it is too weak, and under the second that they differ, each as an alert", () => {
    const html = render({ ...FILLED, weak: true, mismatch: true });
    const [, next = "", confirm = ""] = startTags(html, "input");

    expect(html.match(/role="alert"/g)).toHaveLength(2);
    expect(textOf(html)).toContain("Password does not meet all requirements");
    expect(textOf(html)).toContain("Passwords do not match");
    expect(attribute(next, "aria-invalid")).toBe("true");
    expect(attribute(confirm, "aria-invalid")).toBe("true");
  });

  it("says nothing of them until they are asked about", () => {
    const html = render(FILLED);

    expect(html).not.toContain('role="alert"');
    for (const input of startTags(html, "input")) {
      expect(attribute(input, "aria-invalid")).toBeUndefined();
    }
  });

  it("says that it changed, as a status, and that it did not, as an alert, keeping what was typed", () => {
    expect(render({ saved: true })).toContain('role="status"');
    expect(textOf(render({ saved: true }))).toContain("Password changed");

    const failed = render({ ...FILLED, failed: true });
    expect(failed.match(/role="alert"/g)).toHaveLength(1);
    expect(textOf(failed)).toContain("We couldn't change your password.");
    expect(attribute(startTags(failed, "input")[0] ?? "", "value")).toBe("old-Secret-1");
  });

  it("holds the fields read-only, not disabled, while it sends, and Change keeps the focus by loading", () => {
    const html = render({ ...FILLED, pending: true });
    const change = submitOf(html);

    for (const input of startTags(html, "input")) {
      expect(attribute(input, "readOnly")).toBe("");
      expect(attribute(input, "disabled")).toBeUndefined();
    }
    expect(attribute(change, "aria-disabled")).toBe("true");
    expect(attribute(change, "data-loading")).toBe("");
    expect(attribute(change, "disabled")).toBeUndefined();
  });

  it("speaks French", () => {
    const html = render({ ...FILLED, weak: true, failed: true }, "fr");

    expect(elements(html, "label").map(textOf)).toEqual(["Mot de passe actuel*", "Nouveau mot de passe*", "Confirmer le nouveau mot de passe*"]);
    expect(textOf(html)).toContain("Impossible de modifier votre mot de passe.");
    expect(textOf(elements(html, "button").at(-1) ?? "")).toBe("Changer le mot de passe");
  });
});

describe("the connected accounts card", () => {
  const GOOGLE = { id: "a1", providerId: "google" };
  const PASSWORD = { id: "a3", providerId: "credential" };

  const render = (props: Partial<ComponentProps<typeof ConnectedAccountsView>> = {}, locale: Locale = "en") =>
    renderWithIntl(
      <ConnectedAccountsView
        status="ready"
        accounts={[PASSWORD, GOOGLE]}
        busy={null}
        onConnect={() => {}}
        onDisconnect={() => {}}
        onRetry={() => {}}
        labelledBy={TITLE_ID}
        {...props}
      />,
      locale,
    );

  it("is a skeleton of the two providers, announced once, while the accounts are read", () => {
    const html = render({ status: "loading", accounts: [] });

    expect(html).toContain('data-slot="list-skeleton"');
    expect(html).toContain('aria-busy="true"');
    expect(textOf(html)).toBe("Loading…");
    expect(html.match(/data-slot="list-skeleton-row"/g)).toHaveLength(2);
  });

  it("says that the accounts could not be read, as an alert, with a way to try again", () => {
    const html = render({ status: "failed", accounts: [] });

    expect(html).toContain('role="alert"');
    expect(textOf(html)).toContain("We couldn't load your connected accounts.");
    expect(textOf(elements(html, "button")[0] ?? "")).toBe("Try again");
  });

  it("draws one row for each provider, each with its mark in a tile", () => {
    const html = render();

    expect(elements(html, "li")).toHaveLength(2);
    expect(textOf(elements(html, "li")[0] ?? "")).toContain("Google");
    expect(textOf(elements(html, "li")[1] ?? "")).toContain("GitHub");
    expect(html.match(/data-slot="icon-tile"/g)).toHaveLength(2);
  });

  // The name itself (a screen reader says "Connected accounts, list, 2 items") is the work
  // of the stories, which have a browser to compute it.
  it("is named by the title of its card: the list points at it by the id the page gives", () => {
    const [list = ""] = startTags(render({ labelledBy: "title-of-the-card" }), "ul");

    expect(attribute(list, "role")).toBe("list");
    expect(attribute(list, "aria-labelledby")).toBe("title-of-the-card");
  });

  it("tells the one that is linked with a quiet badge, and offers to connect the other", () => {
    const [google = "", github = ""] = elements(render(), "li");

    expect(textOf(google)).toContain("Connected");
    expect(decodedClassesOf(startTags(google, "span").find((tag) => attribute(tag, "data-slot") === "badge") ?? "")).toContain("bg-secondary");
    expect(textOf(github)).not.toContain("Connected");
    expect(textOf(elements(github, "button")[0] ?? "")).toBe("Connect");
    expect(textOf(elements(google, "button")[0] ?? "")).toBe("Disconnect");
  });

  it("says which provider a button acts on, for those who hear it: two rows would both read Connect", () => {
    const html = render();

    expect(attribute(buttonNamed(html, "Disconnect Google"), "type")).toBe("button");
    expect(attribute(buttonNamed(html, "Connect GitHub"), "type")).toBe("button");
  });

  it("lets the person unlink an account while they have another way to sign in", () => {
    expect(attribute(buttonNamed(render(), "Disconnect Google"), "disabled")).toBeUndefined();
  });

  it("does not let them unlink the last way to sign in, and says why", () => {
    const html = render({ accounts: [GOOGLE] });
    const disconnect = buttonNamed(html, "Disconnect Google");

    expect(attribute(disconnect, "disabled")).toBe("");
    expect(textOf(html)).toContain("Cannot disconnect your only sign-in method.");
  });

  it("loads on the button that works, and holds the other one", () => {
    const html = render({ accounts: [PASSWORD, GOOGLE], busy: "github" });
    const connect = buttonNamed(html, "Connect GitHub");
    const disconnect = buttonNamed(html, "Disconnect Google");

    expect(attribute(connect, "data-loading")).toBe("");
    expect(attribute(connect, "aria-disabled")).toBe("true");
    expect(attribute(connect, "disabled")).toBeUndefined();
    expect(attribute(disconnect, "disabled")).toBe("");
  });

  it("speaks French", () => {
    const html = render({}, "fr");

    expect(textOf(html)).toContain("Connecté");
    expect(attribute(buttonNamed(html, "Déconnecter Google"), "type")).toBe("button");
    expect(attribute(buttonNamed(html, "Connecter GitHub"), "type")).toBe("button");
  });
});

describe("the sessions card", () => {
  const CHROME_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  const SAFARI_IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const EDGE_WINDOWS =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";

  // Midday in UTC: the same date in every time zone from -11 to +11
  const NOW = { id: "s1", token: "tok-now", userAgent: CHROME_MAC, ipAddress: "203.0.113.7", createdAt: "2026-11-03T12:00:00.000Z" };
  const PHONE = { id: "s2", token: "tok-phone", userAgent: SAFARI_IPHONE, ipAddress: null, createdAt: new Date("2026-11-01T12:00:00.000Z") };
  const OLD = { id: "s3", token: "tok-old", userAgent: EDGE_WINDOWS, ipAddress: "198.51.100.2", createdAt: "2026-10-20T12:00:00.000Z" };

  const render = (props: Partial<ComponentProps<typeof ActiveSessionsView>> = {}, locale: Locale = "en") =>
    renderWithIntl(
      <ActiveSessionsView
        status="ready"
        sessions={[NOW, PHONE, OLD]}
        currentToken="tok-now"
        revoking={null}
        revokingAll={false}
        onRevoke={() => {}}
        onRevokeAll={() => {}}
        onRetry={() => {}}
        labelledBy={TITLE_ID}
        {...props}
      />,
      locale,
    );

  it("is a skeleton, announced once, while the sessions are read", () => {
    const html = render({ status: "loading", sessions: [] });

    expect(html).toContain('data-slot="list-skeleton"');
    expect(textOf(html)).toBe("Loading…");
  });

  it("says that the sessions could not be read, as an alert, with a way to try again", () => {
    const html = render({ status: "failed", sessions: [] });

    expect(html).toContain('role="alert"');
    expect(textOf(html)).toContain("We couldn't load your sessions.");
    expect(textOf(elements(html, "button")[0] ?? "")).toBe("Try again");
  });

  // The name itself (a screen reader says "Sessions, list, 3 items") is the work of the
  // stories, which have a browser to compute it.
  it("is named by the title of its card: the list points at it by the id the page gives", () => {
    const [list = ""] = startTags(render({ labelledBy: "title-of-the-card" }), "ul");

    expect(attribute(list, "role")).toBe("list");
    expect(attribute(list, "aria-labelledby")).toBe("title-of-the-card");
  });

  // Where the focus goes when the button that had it is revoked away with its row (the
  // card puts it there: see the story that revokes). Never a tab stop, and no ring: nothing
  // in the box is to be pressed.
  it("is drawn in a box that can take the focus, round the button and the list", () => {
    const html = render();
    const [region = ""] = startTags(html, "div").filter((tag) => attribute(tag, "tabindex") === "-1");

    expect(region).not.toBe("");
    expect(decodedClassesOf(region)).toContain("focus:outline-hidden");
    expect(html.indexOf(region)).toBeLessThan(html.indexOf("Revoke all other sessions"));
    expect(html.indexOf(region)).toBeLessThan(html.indexOf("<ul"));
  });

  it("says what each device is, read from its user agent, the browser first", () => {
    const [now = "", phone = "", old = ""] = elements(render(), "li");

    expect(textOf(now)).toContain("Chrome on macOS");
    expect(textOf(phone)).toContain("Safari on iOS");
    // Edge says Chrome and Safari too: it is told as Edge
    expect(textOf(old)).toContain("Edge on Windows");
  });

  it("falls back to the part it knows, then to a word, for a device it cannot read", () => {
    const html = render({
      sessions: [
        { ...NOW, userAgent: "curl/8.0" },
        { id: "s4", token: "t4", userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0", createdAt: NOW.createdAt },
        { id: "s5", token: "t5", userAgent: null, createdAt: NOW.createdAt },
        { id: "s6", token: "t6", userAgent: "Mozilla/5.0 (Linux; Android 14) Mobile", createdAt: NOW.createdAt },
      ],
    });
    const rows = elements(html, "li").map(textOf);

    expect(rows[0]).toContain("Unknown device");
    expect(rows[1]).toContain("Firefox on Linux");
    expect(rows[2]).toContain("Unknown device");
    expect(rows[3]).toContain("Android");
  });

  it("tells the session in use with a quiet badge, and gives it no button: signing out is the account menu's", () => {
    const [now = "", phone = ""] = elements(render(), "li");
    const badge = startTags(now, "span").find((tag) => attribute(tag, "data-slot") === "badge") ?? "";

    expect(textOf(now)).toContain("Current session");
    expect(decodedClassesOf(badge)).toContain("bg-secondary");
    expect(decodedClassesOf(badge)).not.toContain("bg-brand");
    expect(elements(now, "button")).toEqual([]);
    expect(textOf(phone)).not.toContain("Current session");
  });

  it("gives each of the other sessions a button that says which session it ends", () => {
    const html = render();

    expect(attribute(buttonNamed(html, "Revoke the session on Safari on iOS"), "type")).toBe("button");
    expect(attribute(buttonNamed(html, "Revoke the session on Edge on Windows"), "type")).toBe("button");
    expect(textOf(elements(elements(html, "li")[1] ?? "", "button")[0] ?? "")).toBe("Revoke");
  });

  it("gives the address and the date of each session, the date as a time element", () => {
    const [now = "", phone = ""] = elements(render(), "li");

    expect(textOf(now)).toContain("203.0.113.7 · ");
    expect(textOf(now)).toContain("Nov 3, 2026");
    expect(startTags(now, "time").map((tag) => attribute(tag, "dateTime"))).toEqual(["2026-11-03T12:00:00.000Z"]);
    // No address: no dot before the date
    expect(textOf(phone)).not.toContain("·");
    expect(textOf(phone)).toContain("Nov 1, 2026");
  });

  it("offers to revoke all the others only when there is another, as the one outline button above the list", () => {
    const html = render();
    const alone = render({ sessions: [NOW] });

    expect(textOf(elements(html, "button")[0] ?? "")).toBe("Revoke all other sessions");
    expect(attribute(buttonNamed(html, "Revoke all other sessions"), "type")).toBe("button");
    expect(elements(alone, "button")).toEqual([]);
    expect(elements(alone, "li")).toHaveLength(1);
  });

  it("loads on the button that works, and holds the others", () => {
    const one = render({ revoking: "tok-phone" });
    const phone = buttonNamed(one, "Revoke the session on Safari on iOS");

    expect(attribute(phone, "data-loading")).toBe("");
    expect(attribute(phone, "disabled")).toBeUndefined();
    expect(attribute(buttonNamed(one, "Revoke the session on Edge on Windows"), "disabled")).toBe("");
    expect(attribute(buttonNamed(one, "Revoke all other sessions"), "disabled")).toBe("");

    const all = render({ revokingAll: true });
    expect(attribute(buttonNamed(all, "Revoke all other sessions"), "data-loading")).toBe("");
    expect(attribute(buttonNamed(all, "Revoke the session on Safari on iOS"), "disabled")).toBe("");
  });

  it("speaks French, dates included", () => {
    const html = render({}, "fr");

    expect(textOf(html)).toContain("Chrome sur macOS");
    expect(textOf(html)).toContain("Session actuelle");
    expect(textOf(html)).toContain("3 nov. 2026");
    expect(attribute(buttonNamed(html, "Révoquer la session sur Safari sur iOS"), "type")).toBe("button");
  });
});
