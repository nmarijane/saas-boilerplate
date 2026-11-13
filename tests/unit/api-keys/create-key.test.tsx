import type { ComponentProps } from "react";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateKeyButton } from "@/features/api-keys/components/create-key-button";
import { CreatedKeyView, CreateKeyFormView } from "@/features/api-keys/components/create-key-modal";
import { earliestEnd } from "@/features/api-keys/expiry";
import { createKeyFlow, earliestAfter } from "@/features/api-keys/key-flows";
import { KEY_NAME_MAX } from "@/features/api-keys/limits";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
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

// The dialog calls the server action and reads the page again through the router:
// both are replaced, so nothing here reaches the database or the network.
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }),
    redirect: () => undefined,
    useRouter: () => ({ push: () => {}, refresh: () => {} }),
    usePathname: () => "/settings/developers",
  };
});
vi.mock("@/features/api-keys/actions", () => ({
  createApiKeyAction: vi.fn(),
  revokeApiKeyAction: vi.fn(),
}));

type Locale = "en" | "fr";

/** The text fields of a form, in order: the boxes draw a hidden input each, which is no field of the person's. */
function fieldsOf(html: string): string[] {
  return startTags(html, "input").filter((tag) => attribute(tag, "data-slot") === "input");
}

const SECRET_KEY = "sk_live_Zk3V-EXAMPLE-0000-0000-0000";

/** The moment the people of these tests ask for their keys: the middle of a day, so that today and tomorrow are not in doubt. */
const NOW = new Date("2026-11-04T12:00:00.000Z");

describe("creating a key, once the person has asked for it", () => {
  const create = vi.fn();
  const refresh = vi.fn();
  const reported = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // A test that makes the router throw must not leave it throwing for the next one
    refresh.mockReset();
    create.mockResolvedValue({ id: "k1", key: SECRET_KEY, prefix: "sk_live_Zk3V" });
    vi.stubGlobal("reportError", reported);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const flow = (override: Partial<Parameters<typeof createKeyFlow>[1]> = {}) =>
    createKeyFlow({ create, refresh, now: () => NOW }, { orgId: "org_1", name: "  Production server ", scopes: ["read", "write"], expires: "", ...override });

  it("sends the name without its spaces, with the scopes and the workspace, and no end for a key that has none", async () => {
    await flow();

    expect(create).toHaveBeenCalledExactlyOnceWith("org_1", {
      name: "Production server",
      scopes: ["read", "write"],
      expiresAt: undefined,
    });
  });

  it("sends the end of the key as a date when there is one: the day, at its start", async () => {
    await flow({ expires: "2026-12-31" });

    expect(create).toHaveBeenCalledWith("org_1", expect.objectContaining({ expiresAt: new Date("2026-12-31T00:00:00.000Z") }));
  });

  it("hands the key back, after it has read the page again, so that the list behind the dialog shows it", async () => {
    await expect(flow()).resolves.toEqual({ outcome: "created", key: SECRET_KEY });

    expect(refresh).toHaveBeenCalledOnce();
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0] ?? 0);
  });

  it("fails when the call does not come back, tells the error reporter, and does not read the page again", async () => {
    create.mockRejectedValue(new Error("offline"));

    await expect(flow()).resolves.toEqual({ outcome: "failed" });

    expect(reported).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "offline" }));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("fails when the server refuses the input, as it does for a name it cannot take", async () => {
    create.mockRejectedValue(new Error("Too big"));

    await expect(flow({ name: "x".repeat(KEY_NAME_MAX + 1) })).resolves.toEqual({ outcome: "failed" });
  });

  // The clock of a page is not always the server's: a few minutes before midnight (UTC) an end that the dialog took
  // for good is today for the server. The server answers with its reason, in its words, and the dialog shows them.
  it.each([
    ["en", "Choose November 6, 2026 or later."],
    ["fr", "Choisissez le 6 novembre 2026 ou une date ultérieure."],
  ])("hands the reason back, as the server wrote it, when the server refuses the end (%s)", async (_, error) => {
    create.mockResolvedValue({ error });

    await expect(flow({ expires: "2026-11-05" })).resolves.toEqual({ outcome: "refused", error });
  });

  it("neither tells the error reporter nor reads the page again for an end that the server refused: nothing was made, and the person has only to pick another day", async () => {
    create.mockResolvedValue({ error: "Choose November 6, 2026 or later." });

    await flow({ expires: "2026-11-05" });

    expect(create).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
    expect(reported).not.toHaveBeenCalled();
  });

  // The key exists once the server has made it: a page that cannot be read again is a lesser thing, and
  // must not cost the key, which is told once. It is told to the reporter, and the dialog shows the key.
  it("still hands the key back when the page cannot be read again, and tells the error reporter", async () => {
    refresh.mockImplementation(() => {
      throw new Error("no router");
    });

    await expect(flow()).resolves.toEqual({ outcome: "created", key: SECRET_KEY });

    expect(create).toHaveBeenCalledOnce();
    expect(reported).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "no router" }));
  });


  it("writes the key nowhere: it is in no log, and in no error that is told to the reporter", async () => {
    const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error"), vi.spyOn(console, "debug")];

    await flow();
    create.mockRejectedValue(new Error("offline"));
    await flow();

    for (const log of logs) {
      expect(log).not.toHaveBeenCalled();
    }
    expect(JSON.stringify(reported.mock.calls)).not.toContain(SECRET_KEY);
  });

  // A key ends at the start of its day (the server takes `2026-12-31` for midnight, UTC), so a key that
  // ends today is over before anyone has used it, and is counted nowhere.
  it.each(["2026-11-04", "2026-11-03", "2026-01-01", "2020-01-01"])("refuses %s as the end of a key, as it is today or before, and sends nothing", async (expires) => {
    // NOW is the middle of 2026-11-04: the first day that is taken is the next one
    await expect(flow({ expires })).resolves.toEqual({ outcome: "past", earliest: "2026-11-05" });

    expect(create).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(reported).not.toHaveBeenCalled();
  });

  it.each(["2026-11-05", "2026-11-06", "2027-01-01"])("takes %s as the end of a key: tomorrow, or later", async (expires) => {
    await expect(flow({ expires })).resolves.toEqual({ outcome: "created", key: SECRET_KEY });

    expect(create).toHaveBeenCalledWith("org_1", expect.objectContaining({ expiresAt: new Date(`${expires}T00:00:00.000Z`) }));
  });

  it("takes no end at all: a key that never ends is a key", async () => {
    await expect(flow({ expires: "" })).resolves.toEqual({ outcome: "created", key: SECRET_KEY });
  });

  // Tomorrow is told by the clock of UTC, which is the clock of the server: the last second of a day is still that day.
  it("tells tomorrow by the clock the server keeps, up to the last moment of the day", async () => {
    const late = new Date("2026-11-04T23:59:59.999Z");
    const justAfter = new Date("2026-11-05T00:00:00.000Z");
    const askedAt = (now: Date, expires: string) =>
      createKeyFlow({ create, refresh, now: () => now }, { orgId: "org_1", name: "Key", scopes: ["*"], expires });

    await expect(askedAt(late, "2026-11-05")).resolves.toMatchObject({ outcome: "created" });
    await expect(askedAt(late, "2026-11-04")).resolves.toEqual({ outcome: "past", earliest: "2026-11-05" });
    // A moment later it is another day, and the end that was good a moment ago is today
    await expect(askedAt(justAfter, "2026-11-05")).resolves.toEqual({ outcome: "past", earliest: "2026-11-06" });
    await expect(askedAt(justAfter, "2026-11-06")).resolves.toMatchObject({ outcome: "created" });
  });
});

describe("the first day a key can end on", () => {
  it("is tomorrow, as a date field holds it", () => {
    expect(earliestEnd(new Date("2026-11-04T12:00:00.000Z"))).toBe("2026-11-05");
    expect(earliestEnd(new Date("2026-11-04T00:00:00.000Z"))).toBe("2026-11-05");
    expect(earliestEnd(new Date("2026-11-04T23:59:59.999Z"))).toBe("2026-11-05");
  });

  it("moves to the next day exactly when UTC does", () => {
    expect(earliestEnd(new Date("2026-11-05T00:00:00.000Z"))).toBe("2026-11-06");
  });

  it("crosses the end of a month and of a year", () => {
    expect(earliestEnd(new Date("2026-11-30T10:00:00.000Z"))).toBe("2026-12-01");
    expect(earliestEnd(new Date("2026-12-31T10:00:00.000Z"))).toBe("2027-01-01");
    expect(earliestEnd(new Date("2028-02-28T10:00:00.000Z"))).toBe("2028-02-29");
  });
});

describe("the dialog that creates a key", () => {
  // The dialog lives in a dialog: its header and its Cancel button need the
  // context of one, which an open `Dialog` gives without drawing a portal.
  function render(props: Partial<ComponentProps<typeof CreateKeyFormView>> = {}, locale: Locale = "en") {
    return renderWithIntl(
      <Dialog open>
        <CreateKeyFormView
          name=""
          scopes={["*"]}
          expires=""
          earliestEnd="2026-11-05"
          pending={false}
          endPast={false}
          failed={false}
          onNameChange={() => {}}
          onScopeToggle={() => {}}
          onExpiresChange={() => {}}
          onSubmit={() => {}}
          {...props}
        />
      </Dialog>,
      locale,
    );
  }

  const submitOf = (html: string) => startTags(html, "button").find((tag) => attribute(tag, "type") === "submit") ?? "";
  const boxesOf = (html: string) => startTags(html, "button").filter((tag) => attribute(tag, "role") === "checkbox");

  it("is a form that checks nothing itself, not the browser: its bubble speaks the language of the browser", () => {
    const [form = ""] = startTags(render(), "form");

    expect(attribute(form, "noValidate")).toBe("");
  });

  it("names the dialog and says what a key is for", () => {
    const text = textOf(render());

    expect(text).toContain("Create API key");
    expect(text).toContain("A key lets your own code call the API for this workspace.");
  });

  it("asks for a name, marked as required and as long as the server takes, and for an end, which is optional", () => {
    const html = render({ name: "Production server" });
    const [name = "", expires = ""] = fieldsOf(html);
    const labels = elements(html, "label").map(textOf);

    expect(labels).toContain("Name*");
    expect(labels).toContain("Expiration");
    expect(html).toContain(`for="${attribute(name, "id")}"`);
    expect(html).toContain(`for="${attribute(expires, "id")}"`);
    expect(attribute(name, "aria-required")).toBe("true");
    expect(attribute(name, "maxLength")).toBe(String(KEY_NAME_MAX));
    expect(attribute(name, "value")).toBe("Production server");
    expect(attribute(expires, "type")).toBe("date");
    expect(attribute(expires, "aria-required")).toBeUndefined();
    expect(decodedClassesOf(name)).toContain("min-h-11");
    expect(decodedClassesOf(expires)).toContain("min-h-11");
    expect(textOf(html)).toContain("Optional. The key stops working at the start of that day (UTC).");
    expect(attribute(expires, "aria-describedby")).toBe(`${attribute(expires, "id")}-hint`);
  });

  it("offers no end before tomorrow: the date field has the first day a key can end on as its minimum", () => {
    const [, expires = ""] = fieldsOf(render({ earliestEnd: "2026-11-05" }));

    expect(attribute(expires, "min")).toBe("2026-11-05");
    expect(attribute(fieldsOf(render({ earliestEnd: "2027-03-01" }))[1] ?? "", "min")).toBe("2027-03-01");
  });

  // Near midnight the clock of the server is ahead of the page's: it says which day it takes, and the form shows its words
  it("says the reason of the server under the field when the server refused the end, and not the sentence it would tell itself", () => {
    const html = render({ expires: "2026-11-05", endPast: true, endRefused: "Choose November 6, 2026 or later." });
    const [, expires = ""] = fieldsOf(html);

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(textOf(html)).toContain("Choose November 6, 2026 or later.");
    expect(textOf(html)).not.toContain("Choose November 5, 2026 or later.");
    expect(attribute(expires, "aria-invalid")).toBe("true");
    expect(attribute(expires, "aria-describedby")).toBe(`${attribute(expires, "id")}-hint ${attribute(expires, "id")}-error`);
    expect(attribute(expires, "value")).toBe("2026-11-05");
  });

  it("shows the reason of the server as it came, in the language of the request, not the language of the page", () => {
    const html = render({ endRefused: "Choisissez le 6 novembre 2026 ou une date ultérieure." }, "en");

    expect(textOf(html)).toContain("Choisissez le 6 novembre 2026 ou une date ultérieure.");
  });

  it("says nothing of the end at rest", () => {
    const html = render({ name: "Production server", expires: "2026-12-31" });

    expect(html).not.toContain('role="alert"');
    expect(attribute(fieldsOf(html)[1] ?? "", "aria-invalid")).toBeUndefined();
  });

  it("says under the field that the end is not after today, as an alert tied to the field, and keeps what was typed", () => {
    const html = render({ name: "Production server", expires: "2020-01-01", endPast: true });
    const [name = "", expires = ""] = fieldsOf(html);

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(textOf(html)).toContain("Choose November 5, 2026 or later.");
    expect(attribute(expires, "aria-invalid")).toBe("true");
    expect(attribute(expires, "aria-describedby")).toBe(`${attribute(expires, "id")}-hint ${attribute(expires, "id")}-error`);
    expect(attribute(expires, "value")).toBe("2020-01-01");
    expect(attribute(name, "value")).toBe("Production server");
    // The name is not at fault: only the end is marked
    expect(attribute(name, "aria-invalid")).toBeUndefined();
  });

  // The message names the first day that is taken, so that the person knows what to pick instead of
  // guessing what "tomorrow" is by the clock of the server: the day is the one the field offers as its minimum.
  it.each([
    ["en", "2026-11-05", "Choose November 5, 2026 or later."],
    ["en", "2027-03-01", "Choose March 1, 2027 or later."],
    ["fr", "2026-11-05", "Choisissez le 5 novembre 2026 ou une date ultérieure."],
    ["fr", "2027-03-01", "Choisissez le 1 mars 2027 ou une date ultérieure."],
  ] as const)("names the earliest day in the message under the field (%s, %s)", (locale, earliestEnd, sentence) => {
    const html = render({ expires: "2020-01-01", endPast: true, earliestEnd }, locale);

    expect(textOf(html)).toContain(sentence);
    expect(attribute(fieldsOf(html)[1] ?? "", "min")).toBe(earliestEnd);
  });

  // The day is written at midnight UTC, and read in UTC: a page whose time zone is west of Greenwich must not
  // be told the day before (midnight UTC is still the evening of the day before there)
  it.each([
    ["en", en, "December 31, 2026"],
    ["fr", fr, "31 décembre 2026"],
  ] as const)("keeps the day whatever time zone the page is set to (%s)", (locale, messages, day) => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="America/Los_Angeles">
        <Dialog open>
          <CreateKeyFormView
            name=""
            scopes={["*"]}
            expires="2020-01-01"
            earliestEnd="2026-12-31"
            pending={false}
            endPast
            failed={false}
            onNameChange={() => {}}
            onScopeToggle={() => {}}
            onExpiresChange={() => {}}
            onSubmit={() => {}}
          />
        </Dialog>
      </NextIntlClientProvider>,
    );

    expect(textOf(html)).toContain(day);
  });

  it("offers the four scopes as a group named Scopes, each a labelled box, the wildcard ticked as a key starts", () => {
    const html = render();
    const [fieldset = ""] = elements(html, "fieldset");

    expect(textOf(elements(fieldset, "legend")[0] ?? "")).toBe("Scopes");
    expect(elements(fieldset, "label").map(textOf)).toEqual(["Read", "Write", "Admin", "All (wildcard)"]);
    expect(boxesOf(html).map((box) => attribute(box, "aria-checked"))).toEqual(["false", "false", "false", "true"]);
    for (const box of boxesOf(html)) {
      expect(decodedClassesOf(box)).toContain("tap-target");
    }
  });

  it("ticks the scopes it is told", () => {
    expect(boxesOf(render({ scopes: ["read", "admin"] })).map((box) => attribute(box, "aria-checked"))).toEqual(["true", "false", "true", "false"]);
  });

  it("waits for a name and a scope: Create is disabled while there is none of either", () => {
    expect(attribute(submitOf(render({ name: "" })), "disabled")).toBe("");
    expect(attribute(submitOf(render({ name: "   " })), "disabled")).toBe("");
    expect(attribute(submitOf(render({ name: "Production server", scopes: [] })), "disabled")).toBe("");
    expect(attribute(submitOf(render({ name: "Production server" })), "disabled")).toBeUndefined();
    expect(textOf(elements(render({ name: "x" }), "button").find((button) => /Create key/.test(button)) ?? "")).toBe("Create key");
  });

  it("is a form whose Create submits it, and whose Cancel does not", () => {
    const html = render({ name: "x" });

    expect(startTags(html, "form")).toHaveLength(1);
    expect(attribute(tagSaying(html, "button", "Cancel"), "type")).toBe("button");
  });

  it("shows no alert at rest", () => {
    expect(render({ name: "x" })).not.toContain('role="alert"');
  });

  it("says that the key was not created, in the dialog, and keeps what was typed", () => {
    const html = render({ name: "Production server", failed: true });

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(textOf(html)).toContain("We couldn't create the key. Please try again.");
    expect(attribute(fieldsOf(html)[0] ?? "", "value")).toBe("Production server");
  });

  it("holds the fields while it sends, read-only where it can be, so that a failure finds the focus where it was", () => {
    const html = render({ name: "Production server", pending: true });
    const [name = "", expires = ""] = fieldsOf(html);
    const create = submitOf(html);

    expect(attribute(name, "readOnly")).toBe("");
    expect(attribute(name, "disabled")).toBeUndefined();
    expect(attribute(expires, "readOnly")).toBe("");
    // A box cannot be read-only: the scopes are held, so that what is shown is what was sent
    for (const box of boxesOf(html)) {
      expect(attribute(box, "disabled")).toBe("");
    }
    // Create keeps the focus and says it works (loading): it is not disabled. Cancel is held.
    expect(attribute(create, "aria-disabled")).toBe("true");
    expect(attribute(create, "data-loading")).toBe("");
    expect(attribute(create, "disabled")).toBeUndefined();
    expect(attribute(tagSaying(html, "button", "Cancel"), "disabled")).toBe("");
  });

  it("speaks French", () => {
    const html = render({ name: "x", failed: true }, "fr");

    expect(textOf(html)).toContain("Créer une clé d'API");
    expect(textOf(html)).toContain("Permissions");
    expect(elements(html, "fieldset").map((fieldset) => elements(fieldset, "label").map(textOf))).toEqual([["Lecture", "Écriture", "Administration", "Toutes (joker)"]]);
    expect(textOf(html)).toContain("Créer la clé");
    expect(textOf(html)).toContain("Impossible de créer la clé. Veuillez réessayer.");
    expect(textOf(render({ name: "x", expires: "2020-01-01", endPast: true }, "fr"))).toContain("Choisissez le 5 novembre 2026 ou une date ultérieure.");
  });
});

describe("the key once it is made", () => {
  const render = (locale: Locale = "en") =>
    renderWithIntl(
      <Dialog open>
        <CreatedKeyView secret={SECRET_KEY} />
      </Dialog>,
      locale,
    );

  it("shows the key, in mono, in the one place it is ever told, and says it will not be shown again", () => {
    const html = render();
    const [code = ""] = elements(html, "code");

    expect(textOf(code)).toBe(SECRET_KEY);
    expect(decodedClassesOf(startTags(html, "code")[0] ?? "")).toEqual(expect.arrayContaining(["font-mono", "break-all", "select-all"]));
    expect(textOf(html)).toContain("API key created");
    expect(textOf(html)).toContain("Copy your key now. You won't be able to see it again.");
  });

  it("holds the key in no field and in no attribute: it is a text, which is read and copied", () => {
    const html = render();

    expect(html.split(SECRET_KEY)).toHaveLength(2);
    expect(startTags(html, "input")).toEqual([]);
  });

  it("has the button that copies it and the one that is done with it", () => {
    const html = render();

    expect(elements(html, "button").map(textOf)).toEqual(["Copy", "Done"]);
    expect(attribute(tagSaying(html, "button", "Done"), "type")).toBe("button");
  });

  it("speaks French", () => {
    const html = render("fr");

    expect(textOf(html)).toContain("Clé d'API créée");
    expect(textOf(html)).toContain("Copiez votre clé maintenant. Elle ne sera plus affichée ensuite.");
    expect(elements(html, "button").map(textOf)).toEqual(["Copier", "Terminé"]);
  });
});

describe("the button that creates a key", () => {
  const html = renderWithIntl(<CreateKeyButton orgId="org_1" />);
  const [button = ""] = startTags(html, "button");

  it("is the one button, 44 px high, that says what it does", () => {
    expect(elements(html, "button")).toHaveLength(1);
    expect(textOf(elements(html, "button")[0] ?? "")).toBe("Create API key");
    expect(decodedClassesOf(button)).toContain("tap-target");
    expect(attribute(button, "type")).toBe("button");
  });

  it("says that it opens a dialog, which is closed, and draws none yet", () => {
    expect(attribute(button, "aria-haspopup")).toBe("dialog");
    expect(attribute(button, "aria-expanded")).toBe("false");
    expect(html).not.toContain('role="dialog"');
  });

  it("is the primary button: the key is the one main action of the Developers page", () => {
    expect(decodedClassesOf(button)).toContain("bg-primary");
  });

  it("speaks French", () => {
    expect(renderWithIntl(<CreateKeyButton orgId="org_1" />, "fr")).toContain("Créer une clé d&#x27;API");
  });
});

// `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere (the session is
// gone, the role is too low): the dialog must not take one for a key that could not be made, nor for a page that could
// not be read again.
describe.each(FRAMEWORK_ERRORS)("%s from the server", (_, framework) => {
  const asked = { orgId: "org_1", name: "Production", scopes: ["*"], expires: "" };
  const now = () => NOW;

  it("is handed on when the key is asked for, and the page is not read again", async () => {
    const reported = vi.fn();
    vi.stubGlobal("reportError", reported);
    const refresh = vi.fn();
    const create = vi.fn().mockRejectedValue(framework);

    expect(await outcomeOf(createKeyFlow({ create, refresh, now }, asked))).toBe(framework);
    expect(refresh).not.toHaveBeenCalled();
    expect(reported).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("is handed on when the page is read again, after the key was made", async () => {
    const reported = vi.fn();
    vi.stubGlobal("reportError", reported);
    const create = vi.fn().mockResolvedValue({ id: "k1", key: SECRET_KEY, prefix: "sk_live_Zk3V" });
    const refresh = vi.fn(() => {
      throw framework;
    });

    expect(await outcomeOf(createKeyFlow({ create, refresh, now }, asked))).toBe(framework);
    expect(reported).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

// A dialog that is open for a few minutes can be open across midnight (UTC): the first day it offered when it opened
// is then today. The end it refuses is checked against the day of the moment it is sent, and the dialog names that
// day and offers it, so that it never says "choose Nov 5 or later" under a field that holds Nov 5 and offers it.
describe("a dialog that stays open across midnight (UTC)", () => {
  const create = vi.fn();
  const sendAt = (now: Date, expires: string) =>
    createKeyFlow({ create, refresh: () => {}, now: () => now }, { orgId: "org_1", name: "Key", scopes: ["*"], expires });

  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ id: "k1", key: SECRET_KEY, prefix: "sk_live_Zk3V" });
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function draw(props: Partial<ComponentProps<typeof CreateKeyFormView>>, locale: Locale = "en") {
    return renderWithIntl(
      <Dialog open>
        <CreateKeyFormView
          name="Key"
          scopes={["*"]}
          expires=""
          earliestEnd="2026-11-05"
          pending={false}
          endPast={false}
          failed={false}
          onNameChange={() => {}}
          onScopeToggle={() => {}}
          onExpiresChange={() => {}}
          onSubmit={() => {}}
          {...props}
        />
      </Dialog>,
      locale,
    );
  }

  it("refuses the day it offered, names the next day, and moves the minimum of the field to it", async () => {
    // It opens at 23:58 UTC, and offers the first day there is: the next one
    vi.setSystemTime(new Date("2026-11-04T23:58:00.000Z"));
    const offered = earliestEnd(new Date());
    expect(offered).toBe("2026-11-05");

    // It is sent at 00:01 UTC with that day: it is today now
    vi.setSystemTime(new Date("2026-11-05T00:01:00.000Z"));
    const outcome = await sendAt(new Date(), offered);
    expect(outcome).toEqual({ outcome: "past", earliest: "2026-11-06" });
    expect(create).not.toHaveBeenCalled();

    // What the dialog draws then: the message and the minimum name the same day, and not the one that is refused
    const earliest = earliestAfter(offered, outcome);
    const html = draw({ expires: offered, endPast: true, earliestEnd: earliest });
    const [, field = ""] = fieldsOf(html);

    expect(earliest).toBe("2026-11-06");
    expect(textOf(html)).toContain("Choose November 6, 2026 or later.");
    expect(textOf(html)).not.toContain("Choose November 5, 2026 or later.");
    expect(attribute(field, "min")).toBe("2026-11-06");
    expect(attribute(field, "value")).toBe("2026-11-05");
  });

  it("says it in French too", async () => {
    vi.setSystemTime(new Date("2026-11-05T00:01:00.000Z"));
    const outcome = await sendAt(new Date(), "2026-11-05");

    const html = draw({ expires: "2026-11-05", endPast: true, earliestEnd: earliestAfter("2026-11-05", outcome) }, "fr");

    expect(textOf(html)).toContain("Choisissez le 6 novembre 2026 ou une date ultérieure.");
  });

  it("keeps the day it offered for any answer that is not a refusal as past", () => {
    expect(earliestAfter("2026-11-05", { outcome: "created", key: SECRET_KEY })).toBe("2026-11-05");
    expect(earliestAfter("2026-11-05", { outcome: "refused", error: "Choose November 7, 2026 or later." })).toBe("2026-11-05");
    expect(earliestAfter("2026-11-05", { outcome: "failed" })).toBe("2026-11-05");
  });

  it("takes the day it offered, when it is sent before midnight", async () => {
    vi.setSystemTime(new Date("2026-11-04T23:59:30.000Z"));

    await expect(sendAt(new Date(), "2026-11-05")).resolves.toEqual({ outcome: "created", key: SECRET_KEY });
  });
});
