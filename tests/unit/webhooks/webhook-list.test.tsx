import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteWebhookEndpointAction,
  toggleWebhookEndpointAction,
} from "@/features/webhooks/actions";
import { WebhookList } from "@/features/webhooks/components/webhook-list";
import { toast } from "@/shared/components/ui/sonner";
import { reset, rows } from "../../helpers/fake-dropdown-menu";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// What the lists reach for outside themselves, replaced: the menu of a row (Radix
// draws it in a portal, which a static render leaves out: the stand-in draws each
// part in place and keeps what choosing a row does), the router, the toasts, the
// server actions, and the confirm dialog, whose props are what a row decides to
// ask. What Radix does with them (opening, focus) is the work of the stories. The
// switch is drawn as it is, and its props are kept: what moving it makes the row do
// is what the tests call.
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const confirm = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[] }));
const switches = vi.hoisted(() => ({
  calls: [] as { "aria-label"?: string; checked?: boolean; onCheckedChange?: (checked: boolean) => void }[],
}));

vi.mock("@/shared/components/ui/dropdown-menu", () => import("../../helpers/fake-dropdown-menu"));
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }),
    redirect: () => undefined,
    useRouter: () => router,
    usePathname: () => "/settings/developers",
  };
});
vi.mock("@/shared/components/ui/sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/components/ui/sonner")>()),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/features/webhooks/actions", () => ({
  createWebhookEndpointAction: vi.fn(),
  deleteWebhookEndpointAction: vi.fn(),
  toggleWebhookEndpointAction: vi.fn(),
}));
vi.mock("@/shared/components/ui/switch", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/components/ui/switch")>();
  const { createElement } = await import("react");

  return {
    ...original,
    Switch: (props: Parameters<typeof original.Switch>[0]) => {
      switches.calls.push(props);
      return createElement(original.Switch, props);
    },
  };
});
vi.mock("@/shared/components/ui/confirm-dialog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/components/ui/confirm-dialog")>()),
  ConfirmDialog: (props: Record<string, unknown>) => {
    confirm.calls.push(props);
    return null;
  },
}));

const ORG = "org_1";

type Locale = "en" | "fr";

/** The line under the name of a row: what is known of the key or of the endpoint. */
function metaOf(row: string): string {
  const [, meta = ""] = /<div class="text-meta wrap-break-word text-ink-muted">([\s\S]*?)<\/div>/.exec(row) ?? [];
  return meta;
}

/** The labels of the buttons that open a menu, in order: the buttons that say who they act for, the switches left out. */
function menusOf(html: string): string[] {
  return startTags(html, "button")
    .filter((tag) => attribute(tag, "role") !== "switch")
    .map((tag) => attribute(tag, "aria-label"))
    .filter((label) => label !== undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  reset();
  confirm.calls.length = 0;
  switches.calls.length = 0;
  vi.mocked(deleteWebhookEndpointAction).mockResolvedValue(undefined);
  vi.mocked(toggleWebhookEndpointAction).mockResolvedValue(undefined);
});

function endpoint(overrides: Partial<ComponentProps<typeof WebhookList>["endpoints"][number]> = {}): ComponentProps<typeof WebhookList>["endpoints"][number] {
  return {
    id: "e1",
    url: "https://example.com/hooks/billing",
    active: true,
    eventCount: 3,
    createdAt: "2026-11-03T12:00:00.000Z",
    ...overrides,
  };
}

const LIVE = endpoint();
const PAUSED = endpoint({ id: "e2", url: "https://example.org/events", active: false, eventCount: 1 });

describe("the list of webhook endpoints", () => {
  const render = (endpoints = [LIVE, PAUSED], locale: Locale = "en") => {
    reset();
    confirm.calls.length = 0;
    return renderWithIntl(<WebhookList orgId={ORG} endpoints={endpoints} />, locale);
  };
  const switchesOf = (html: string) => startTags(html, "button").filter((tag) => attribute(tag, "role") === "switch");

  it("is a card with a level-two title, which names its list", () => {
    const html = render();
    const [title = ""] = startTags(html, "h2");
    const [list = ""] = startTags(html, "ul");

    expect(elements(html, "h2").map(textOf)).toEqual(["Webhooks"]);
    expect(attribute(list, "aria-labelledby")).toBe(attribute(title, "id"));
  });

  it("has one secondary button that adds an endpoint, which says that it opens a dialog", () => {
    const html = render();
    const [add = ""] = startTags(html, "button").filter((tag) => attribute(tag, "aria-haspopup") === "dialog");

    expect(elements(html, "button").filter((button) => textOf(button) === "Add endpoint")).toHaveLength(1);
    expect(attribute(add, "aria-expanded")).toBe("false");
    expect(attribute(add, "type")).toBe("button");
    // Secondary: an outline, not the filled primary button, which is the header's
    expect(decodedClassesOf(add)).toContain("border-input");
    expect(decodedClassesOf(add)).not.toContain("bg-primary");
    expect(html).not.toContain('role="dialog"');
  });

  it("is one row for each endpoint: its address, how many events it asks for, and the day it was added", () => {
    const [first = "", second = ""] = elements(render(), "li");

    expect(textOf(first)).toContain("https://example.com/hooks/billing");
    expect(textOf(metaOf(first))).toBe("3 events · Added Nov 3, 2026");
    expect(textOf(metaOf(second))).toBe("1 event · Added Nov 3, 2026");
    expect(startTags(metaOf(first), "time").map((tag) => attribute(tag, "dateTime"))).toEqual(["2026-11-03T12:00:00.000Z"]);
  });

  it("turns the delivery to an endpoint on and off with a switch that says which endpoint, and where it is", () => {
    const [on = "", off = ""] = switchesOf(render());

    expect(attribute(on, "aria-label")).toBe("Send events to https://example.com/hooks/billing");
    expect(attribute(on, "aria-checked")).toBe("true");
    expect(attribute(off, "aria-label")).toBe("Send events to https://example.org/events");
    expect(attribute(off, "aria-checked")).toBe("false");
    expect(decodedClassesOf(on)).toContain("tap-target");
  });

  it("says the state once: the switch is the indicator, and no badge repeats it", () => {
    const html = render();

    expect(html).not.toContain('data-slot="badge"');
    expect(textOf(html)).not.toMatch(/Active|Paused|Disabled/);
  });

  it("offers the menu on every endpoint, to delete it", () => {
    expect(menusOf(render())).toEqual([
      "Actions for https://example.com/hooks/billing",
      "Actions for https://example.org/events",
    ]);
    expect(rows.map(({ label }) => label)).toEqual(["Delete endpoint", "Delete endpoint"]);
  });

  it("says that there is no endpoint with an empty state under the title, with no button of its own: the section has the one", () => {
    const html = render([]);

    expect(html).toContain('data-slot="empty-state"');
    expect(elements(html, "h3").map(textOf)).toEqual(["No webhooks yet"]);
    expect(textOf(html)).toContain("Add an endpoint to be told when something happens in your workspace.");
    expect(elements(html, "button").map(textOf)).toEqual(["Add endpoint"]);
    expect(startTags(html, "ul")).toEqual([]);
  });

  it("speaks French, with the plural of French", () => {
    const html = render([LIVE, PAUSED], "fr");
    const [first = "", second = ""] = elements(html, "li");

    expect(elements(html, "h2").map(textOf)).toEqual(["Webhooks"]);
    expect(textOf(html)).toContain("Ajouter un endpoint");
    expect(textOf(metaOf(first))).toBe("3 événements · Ajouté le 3 nov. 2026");
    expect(textOf(metaOf(second))).toBe("1 événement · Ajouté le 3 nov. 2026");
    expect(attribute(switchesOf(html)[0] ?? "", "aria-label")).toBe("Envoyer les événements à https://example.com/hooks/billing");
    expect(rows[0]?.label).toBe("Supprimer l'endpoint");
    expect(textOf(render([], "fr"))).toContain("Aucun webhook pour le moment");
  });
});

/** What a tag holds, from its start tag to the end tag that closes it (for an element that nests in itself: a div). */
function innerOfFirst(html: string, startTag: string): string {
  const start = html.indexOf(startTag);
  expect(start, startTag).toBeGreaterThanOrEqual(0);
  let depth = 1;
  let cursor = start + startTag.length;
  while (depth > 0) {
    const open = html.indexOf("<div", cursor);
    const close = html.indexOf("</div>", cursor);
    if (close === -1) {
      throw new Error("The div is never closed");
    }
    if (open !== -1 && open < close) {
      depth += 1;
      cursor = open + 4;
    } else {
      depth -= 1;
      cursor = close + 6;
    }
  }

  return html.slice(start + startTag.length, cursor - 6);
}

// The row that is deleted takes the focus with it, and the list is what keeps it: a box that is not a
// tab stop. The page reads itself again once the last endpoint is gone, and swaps the list for the
// empty state: a box that went with the list would drop the focus on the page. The stories watch the
// focus itself in a browser (DeletesTheLastEndpoint); this is the markup that makes it possible.
describe("the box that keeps the focus when a row goes", () => {
  const BOX = '<div tabindex="-1" class="focus:outline-hidden">';
  const CONTENT = '<div data-slot="card-content" class="px-5">';
  const render = (endpoints: ReturnType<typeof endpoint>[]) => {
    reset();
    return renderWithIntl(<WebhookList orgId={ORG} endpoints={endpoints} />);
  };
  /** The boxes of a render that are not a tab stop: the switches draw a hidden field each, which is not a box. */
  const boxesOf = (html: string) => startTags(html, "div").filter((tag) => attribute(tag, "tabindex") === "-1");

  it("holds the list when there are endpoints, and is the one box that is not a tab stop", () => {
    const html = render([LIVE, PAUSED]);

    expect(boxesOf(html)).toHaveLength(1);
    expect(innerOfFirst(html, BOX)).toContain('data-slot="list"');
    expect(innerOfFirst(html, BOX)).not.toContain('data-slot="empty-state"');
  });

  it("holds the empty state when there is none: it is drawn in both cases, so that the swap between them does not drop the focus", () => {
    const html = render([]);

    expect(boxesOf(html)).toHaveLength(1);
    expect(innerOfFirst(html, BOX)).toContain('data-slot="empty-state"');
    expect(innerOfFirst(html, BOX)).not.toContain('data-slot="list"');
  });

  it("is the same box in both cases, the whole content of the card: only what it holds changes", () => {
    for (const html of [render([LIVE]), render([])]) {
      const content = innerOfFirst(html, CONTENT);

      expect(content.startsWith(BOX)).toBe(true);
      expect(content).toBe(`${BOX}${innerOfFirst(html, BOX)}</div>`);
    }
  });
});

// What moving the switch makes the row do, with the server action replaced by one that answers or refuses.
// That the switch goes back when the server refuses is a rule of `endpointSwitch` (endpoint-switch.test.ts,
// "goes back to where it was when the server did not do it"), which the static render cannot draw a
// second time to show; the story ToggleRefused watches it in a browser.
describe("moving the switch of an endpoint", () => {
  const reported = vi.fn();

  beforeEach(() => {
    reported.mockClear();
    vi.stubGlobal("reportError", reported);
    reset();
    renderWithIntl(<WebhookList orgId={ORG} endpoints={[LIVE, PAUSED]} />);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Lets what the row does after an answer (it is all promises) run to its end. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  /** What the row of this address gives its switch. */
  function switchOf(url: string) {
    const found = switches.calls.find((props) => props["aria-label"] === `Send events to ${url}`);
    expect(found, `a switch for ${url}`).toBeDefined();
    return found as { checked?: boolean; onCheckedChange: (checked: boolean) => void };
  }

  it("shows each switch where the page read its endpoint", () => {
    expect(switchOf("https://example.com/hooks/billing").checked).toBe(true);
    expect(switchOf("https://example.org/events").checked).toBe(false);
  });

  it("asks the server for the endpoint by its own id, in the workspace, with the place the switch was moved to", async () => {
    switchOf("https://example.org/events").onCheckedChange(true);

    await vi.waitFor(() => expect(toggleWebhookEndpointAction).toHaveBeenCalledOnce());
    expect(toggleWebhookEndpointAction).toHaveBeenCalledWith("e2", ORG, true);
  });

  it("says nothing when the server did it, and has nothing to tell the reporter", async () => {
    switchOf("https://example.com/hooks/billing").onCheckedChange(false);

    await settle();
    expect(toggleWebhookEndpointAction).toHaveBeenCalledOnce();
    expect(toast.error).not.toHaveBeenCalled();
    expect(reported).not.toHaveBeenCalled();
  });

  it("says so, and tells the error reporter, when the server does not answer", async () => {
    vi.mocked(toggleWebhookEndpointAction).mockRejectedValue(new Error("offline"));

    switchOf("https://example.com/hooks/billing").onCheckedChange(false);

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
    expect(toast.error).toHaveBeenCalledWith("We couldn't update this endpoint. Please try again.");
    expect(reported).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "offline" }));
    expect(toast.success).not.toHaveBeenCalled();
    // The endpoint is not read again: nothing changed on the server
    expect(router.refresh).not.toHaveBeenCalled();
  });

  // The guard is read at once (a ref), not from the render the call was made in (a state): the render is
  // drawn once, so a state read would let the second and the third through.
  it("asks the server once for a change that is on its way, however many times the switch is moved", async () => {
    let answer: () => void = () => {};
    vi.mocked(toggleWebhookEndpointAction).mockReturnValue(
      new Promise<void>((resolve) => {
        answer = resolve;
      }),
    );
    const live = switchOf("https://example.com/hooks/billing");

    live.onCheckedChange(false);
    live.onCheckedChange(true);
    live.onCheckedChange(false);
    expect(toggleWebhookEndpointAction).toHaveBeenCalledOnce();

    answer();
    await settle();
    // Once it is over, the next change goes through
    live.onCheckedChange(true);
    expect(toggleWebhookEndpointAction).toHaveBeenCalledTimes(2);
  });

  it("says so in French", async () => {
    vi.mocked(toggleWebhookEndpointAction).mockRejectedValue(new Error("offline"));
    switches.calls.length = 0;
    renderWithIntl(<WebhookList orgId={ORG} endpoints={[LIVE]} />, "fr");
    const [props] = switches.calls;

    props?.onCheckedChange?.(false);

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
    expect(toast.error).toHaveBeenCalledWith("Impossible de mettre à jour cet endpoint. Veuillez réessayer.");
  });
});

describe("deleting an endpoint", () => {
  const render = (locale: Locale = "en") => {
    reset();
    confirm.calls.length = 0;
    renderWithIntl(<WebhookList orgId={ORG} endpoints={[LIVE, PAUSED]} />, locale);
  };

  function confirmFor(url: string) {
    const call = confirm.calls.find(({ description }) => typeof description === "string" && description.includes(url));
    expect(call, `a confirmation about ${url}`).toBeDefined();
    return call as { onConfirm: () => Promise<void>; [prop: string]: unknown };
  }

  it("asks first, in the danger tone, naming the address, with nothing to type and a button that says what it does", () => {
    render();
    const dialog = confirmFor("https://example.org/events");

    expect(dialog).toMatchObject({
      open: false,
      tone: "danger",
      title: "Delete this endpoint?",
      confirmLabel: "Delete",
    });
    expect(dialog.requireText).toBeUndefined();
    expect(String(dialog.description)).toContain("can't be undone");
    expect(typeof dialog.onCloseAutoFocus).toBe("function");
    expect(confirm.calls).toHaveLength(2);
  });

  it("deletes the endpoint by its own id, in the workspace, then says so and reads the page again", async () => {
    render();

    await confirmFor("https://example.org/events").onConfirm();

    expect(deleteWebhookEndpointAction).toHaveBeenCalledExactlyOnceWith("e2", ORG);
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Endpoint deleted.");
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("rejects when the server does not answer, so that the dialog stays open with its error and the endpoint still looks there", async () => {
    vi.mocked(deleteWebhookEndpointAction).mockRejectedValue(new Error("offline"));
    render();

    await expect(confirmFor("https://example.com/hooks/billing").onConfirm()).rejects.toThrow("offline");

    expect(toast.success).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("asks in French", () => {
    render("fr");

    expect(confirmFor("https://example.org/events")).toMatchObject({
      title: "Supprimer cet endpoint ?",
      confirmLabel: "Supprimer",
    });
  });
});
