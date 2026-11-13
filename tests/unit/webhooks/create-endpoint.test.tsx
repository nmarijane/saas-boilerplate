import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVAILABLE_EVENTS } from "@/features/webhooks/available-events";
import {
  CreatedEndpointView,
  CreateEndpointFormView,
} from "@/features/webhooks/components/create-webhook-modal";
import { createEndpointFlow, isEndpointUrl } from "@/features/webhooks/endpoint-flows";
import en from "@/locales/en.json";
import { Dialog } from "@/shared/components/ui/dialog";
import { messageAt } from "../../helpers/copy";
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
vi.mock("@/features/webhooks/actions", () => ({
  createWebhookEndpointAction: vi.fn(),
  deleteWebhookEndpointAction: vi.fn(),
  toggleWebhookEndpointAction: vi.fn(),
}));

type Locale = "en" | "fr";

/** The text fields of a form, in order: the boxes draw a hidden input each, which is no field of the person's. */
function fieldsOf(html: string): string[] {
  return startTags(html, "input").filter((tag) => attribute(tag, "data-slot") === "input");
}

const SECRET_SIGNING = "sb_whsec_Q9n3-EXAMPLE-0000-0000-0000";

describe("adding an endpoint, once the person has asked for it", () => {
  const create = vi.fn();
  const refresh = vi.fn();
  const reported = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // A test that makes the router throw must not leave it throwing for the next one
    refresh.mockReset();
    create.mockResolvedValue({ id: "e1", secret: SECRET_SIGNING });
    vi.stubGlobal("reportError", reported);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const flow = (override: Partial<Parameters<typeof createEndpointFlow>[1]> = {}) =>
    createEndpointFlow({ create, refresh }, { orgId: "org_1", url: "  https://example.com/hooks ", events: ["member.invited", "project.created"], ...override });

  it("sends the address without its spaces, with the events and the workspace", async () => {
    await expect(flow()).resolves.toEqual({ outcome: "created", secret: SECRET_SIGNING });

    expect(create).toHaveBeenCalledExactlyOnceWith("org_1", {
      url: "https://example.com/hooks",
      events: ["member.invited", "project.created"],
    });
  });

  it("reads the page again once the endpoint is added, so that the list behind the dialog shows it", async () => {
    await flow();

    expect(refresh).toHaveBeenCalledOnce();
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0] ?? 0);
  });

  // The endpoint exists once the server has added it: a page that cannot be read again is a lesser thing, and
  // must not cost the secret, which is told once. It is told to the reporter, and the dialog shows the secret.
  it("still hands the secret back when the page cannot be read again, and tells the error reporter", async () => {
    refresh.mockImplementation(() => {
      throw new Error("no router");
    });

    await expect(flow()).resolves.toEqual({ outcome: "created", secret: SECRET_SIGNING });

    expect(create).toHaveBeenCalledOnce();
    expect(reported).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "no router" }));
  });

  it("says the address is not one, and sends nothing, when it is not the address of a web page", async () => {
    for (const url of ["example.com", "ftp://example.com/hooks", "javascript:alert(1)", "https://", "not a url", "//example.com", "   "]) {
      await expect(flow({ url }), url).resolves.toEqual({ outcome: "invalid" });
    }

    expect(create).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("fails when the call does not come back, tells the error reporter, and does not read the page again", async () => {
    create.mockRejectedValue(new Error("offline"));

    await expect(flow()).resolves.toEqual({ outcome: "failed" });

    expect(reported).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "offline" }));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("writes the secret nowhere: it is in no log, and in no error that is told to the reporter", async () => {
    const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error"), vi.spyOn(console, "debug")];

    await flow();
    create.mockRejectedValue(new Error("offline"));
    await flow();

    for (const log of logs) {
      expect(log).not.toHaveBeenCalled();
    }
    expect(JSON.stringify(reported.mock.calls)).not.toContain(SECRET_SIGNING);
  });
});

describe("the address of an endpoint", () => {
  it.each([
    "https://example.com",
    "https://example.com/hooks/billing?team=a#top",
    "HTTPS://EXAMPLE.COM/Hook",
  ])("is %s", (url) => {
    expect(isEndpointUrl(url)).toBe(true);
  });

  it.each([
    "",
    "example.com",
    "//example.com",
    "ftp://example.com",
    "http://example.com/hook",
    "http://localhost:3000/hook",
    "https://user:secret@example.com/hook",
    "javascript:alert(1)",
    "data:text/plain,hi",
    "mailto:mia@example.com",
    "https://",
    "https:// example.com",
  ])("is not %j", (text) => {
    expect(isEndpointUrl(text)).toBe(false);
  });
});

describe("the dialog that adds an endpoint", () => {
  function render(props: Partial<ComponentProps<typeof CreateEndpointFormView>> = {}, locale: Locale = "en") {
    return renderWithIntl(
      <Dialog open>
        <CreateEndpointFormView
          url=""
          events={[]}
          pending={false}
          invalid={false}
          failed={false}
          onUrlChange={() => {}}
          onEventToggle={() => {}}
          onSubmit={() => {}}
          {...props}
        />
      </Dialog>,
      locale,
    );
  }

  const submitOf = (html: string) => startTags(html, "button").find((tag) => attribute(tag, "type") === "submit") ?? "";
  const boxesOf = (html: string) => startTags(html, "button").filter((tag) => attribute(tag, "role") === "checkbox");
  /** What the message files say of each event, in the order the picker offers them. */
  const ENGLISH_LABELS = AVAILABLE_EVENTS.map((name) => messageAt(en, `webhooks.event.${name}`));

  it("is a form that checks the address itself, not the browser", () => {
    expect(attribute(startTags(render(), "form")[0] ?? "", "noValidate")).toBe("");
  });

  it("names the dialog and says what an endpoint receives", () => {
    const text = textOf(render());

    expect(text).toContain("Add endpoint");
    expect(text).toContain("We send a request to this address each time one of the events you pick happens.");
  });

  it("asks for an address, marked as required, typed for a web address, and labelled", () => {
    const html = render({ url: "https://example.com/hooks" });
    const [url = ""] = fieldsOf(html);

    expect(elements(html, "label").map(textOf)).toContain("Endpoint URL*");
    expect(html).toContain(`for="${attribute(url, "id")}"`);
    expect(attribute(url, "type")).toBe("url");
    expect(attribute(url, "inputMode")).toBe("url");
    expect(attribute(url, "aria-required")).toBe("true");
    expect(attribute(url, "placeholder")).toBe("https://example.com/webhooks");
    expect(attribute(url, "value")).toBe("https://example.com/hooks");
    expect(decodedClassesOf(url)).toContain("min-h-11");
  });

  it("offers every event as a labelled box in a group named Events, in the order of the list, with the projects' last", () => {
    const html = render();
    const [fieldset = ""] = elements(html, "fieldset");

    expect(textOf(elements(fieldset, "legend")[0] ?? "")).toBe("Events");
    expect(elements(fieldset, "label").map(textOf)).toEqual(ENGLISH_LABELS);
    expect(boxesOf(html)).toHaveLength(AVAILABLE_EVENTS.length);
    expect(elements(fieldset, "label").map(textOf).slice(-3)).toEqual(["Project created", "Project updated", "Project deleted"]);
    for (const box of boxesOf(html)) {
      expect(decodedClassesOf(box)).toContain("tap-target");
      expect(attribute(box, "aria-checked")).toBe("false");
    }
  });

  it("ticks the events it is told", () => {
    const boxes = boxesOf(render({ events: ["member.invited", "project.deleted"] })).map((box) => attribute(box, "aria-checked"));

    expect(boxes[0]).toBe("true");
    expect(boxes.at(-1)).toBe("true");
    expect(boxes.filter((state) => state === "true")).toHaveLength(2);
  });

  it("does not hold the events in a box that scrolls: the dialog scrolls, and a box inside it would trap the wheel", () => {
    expect(render()).not.toContain("overflow-y-auto max-h");
    expect(render()).not.toMatch(/max-h-48/);
  });

  it("waits for an address and an event: Add is disabled while there is none of either", () => {
    expect(attribute(submitOf(render({ url: "", events: ["member.invited"] })), "disabled")).toBe("");
    expect(attribute(submitOf(render({ url: "  ", events: ["member.invited"] })), "disabled")).toBe("");
    expect(attribute(submitOf(render({ url: "https://example.com", events: [] })), "disabled")).toBe("");
    expect(attribute(submitOf(render({ url: "https://example.com", events: ["member.invited"] })), "disabled")).toBeUndefined();
  });

  it("says under the field that the address is not one, as an alert tied to the field, and keeps what was typed", () => {
    const html = render({ url: "example.com", events: ["member.invited"], invalid: true });
    const [url = ""] = fieldsOf(html);

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(textOf(html)).toContain("Enter a full https address, such as https://example.com/webhooks.");
    expect(attribute(url, "aria-invalid")).toBe("true");
    expect(attribute(url, "aria-describedby")).toBe(`${attribute(url, "id")}-error`);
    expect(attribute(url, "value")).toBe("example.com");
  });

  it("says that the endpoint was not added, in the dialog, and keeps what was typed", () => {
    const html = render({ url: "https://example.com", events: ["member.invited"], failed: true });

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(textOf(html)).toContain("We couldn't add the endpoint. Please try again.");
    expect(attribute(fieldsOf(html)[0] ?? "", "value")).toBe("https://example.com");
  });

  it("holds the fields while it sends, read-only where it can be, and shows that it works without losing the focus", () => {
    const html = render({ url: "https://example.com", events: ["member.invited"], pending: true });
    const [url = ""] = fieldsOf(html);
    const add = submitOf(html);

    expect(attribute(url, "readOnly")).toBe("");
    expect(attribute(url, "disabled")).toBeUndefined();
    for (const box of boxesOf(html)) {
      expect(attribute(box, "disabled")).toBe("");
    }
    expect(attribute(add, "aria-disabled")).toBe("true");
    expect(attribute(add, "disabled")).toBeUndefined();
    expect(attribute(tagSaying(html, "button", "Cancel"), "disabled")).toBe("");
  });

  it("speaks French, the events included", () => {
    const html = render({ url: "https://example.com", events: ["member.invited"], invalid: true }, "fr");
    const labels = elements(elements(html, "fieldset")[0] ?? "", "label").map(textOf);

    expect(textOf(html)).toContain("Ajouter un endpoint");
    expect(textOf(html)).toContain("URL de l'endpoint");
    expect(textOf(html)).toContain("Saisissez une adresse https complète, comme https://example.com/webhooks.");
    expect(labels.slice(0, 3)).toEqual(["Membre invité", "Membre retiré", "Rôle d'un membre modifié"]);
    expect(labels.slice(-3)).toEqual(["Projet créé", "Projet modifié", "Projet supprimé"]);
  });
});

describe("the signing secret once the endpoint is added", () => {
  const render = (locale: Locale = "en") =>
    renderWithIntl(
      <Dialog open>
        <CreatedEndpointView secret={SECRET_SIGNING} />
      </Dialog>,
      locale,
    );

  it("shows the secret, in mono, in the one place it is ever told, and says it will not be shown again", () => {
    const html = render();

    expect(textOf(elements(html, "code")[0] ?? "")).toBe(SECRET_SIGNING);
    expect(html.split(SECRET_SIGNING)).toHaveLength(2);
    expect(startTags(html, "input")).toEqual([]);
    expect(textOf(html)).toContain("Endpoint added");
    expect(textOf(html)).toContain("Copy your signing secret now. You won't be able to see it again.");
    expect(elements(html, "button").map(textOf)).toEqual(["Copy", "Done"]);
  });

  it("speaks French", () => {
    const html = render("fr");

    expect(textOf(html)).toContain("Endpoint ajouté");
    expect(textOf(html)).toContain("Copiez votre secret de signature maintenant. Il ne sera plus affiché ensuite.");
  });
});

// `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere (the session is
// gone, the role is too low): the dialog must not take one for an endpoint that could not be added.
describe.each(FRAMEWORK_ERRORS)("%s from the server", (_, framework) => {
  const asked = { orgId: "org_1", url: "https://example.com/hooks", events: ["member.invited" as const] };

  it("is handed on when the endpoint is added, and the page is not read again", async () => {
    const reported = vi.fn();
    vi.stubGlobal("reportError", reported);
    const refresh = vi.fn();

    expect(await outcomeOf(createEndpointFlow({ create: vi.fn().mockRejectedValue(framework), refresh }, asked))).toBe(framework);
    expect(refresh).not.toHaveBeenCalled();
    expect(reported).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("is handed on when the page is read again, after the endpoint was added", async () => {
    const reported = vi.fn();
    vi.stubGlobal("reportError", reported);
    const refresh = vi.fn(() => {
      throw framework;
    });

    expect(await outcomeOf(createEndpointFlow({ create: vi.fn().mockResolvedValue({ secret: SECRET_SIGNING }), refresh }, asked))).toBe(framework);
    expect(reported).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
