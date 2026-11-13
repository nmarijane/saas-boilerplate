import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revokeApiKeyAction } from "@/features/api-keys/actions";
import { ApiKeyList } from "@/features/api-keys/components/api-key-list";
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
// ask. What Radix does with them (opening, focus) is the work of the stories.
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const confirm = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[] }));

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
vi.mock("@/features/api-keys/actions", () => ({
  createApiKeyAction: vi.fn(),
  revokeApiKeyAction: vi.fn(),
}));
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

function key(overrides: Partial<ComponentProps<typeof ApiKeyList>["keys"][number]> = {}): ComponentProps<typeof ApiKeyList>["keys"][number] {
  return {
    id: "k1",
    name: "Production server",
    prefix: "sk_live_AbCd",
    status: "active",
    createdAt: "2026-11-03T12:00:00.000Z",
    lastUsed: "2026-11-05T09:30:00.000Z",
    ...overrides,
  };
}

const ACTIVE = key();
const EXPIRED = key({ id: "k2", name: "Staging", prefix: "sk_live_Qw3e", status: "expired", lastUsed: null });
const REVOKED = key({ id: "k3", name: "Laptop", prefix: "sk_live_Zz9y", status: "revoked", createdAt: "2026-10-01T12:00:00.000Z" });
const KEYS = [ACTIVE, EXPIRED, REVOKED];

beforeEach(() => {
  vi.clearAllMocks();
  reset();
  confirm.calls.length = 0;
  vi.mocked(revokeApiKeyAction).mockResolvedValue(undefined);
});

describe("the list of API keys", () => {
  const render = (keys = KEYS, locale: Locale = "en") => {
    reset();
    confirm.calls.length = 0;
    return renderWithIntl(<ApiKeyList orgId={ORG} keys={keys} />, locale);
  };

  it("is a card with a level-two title, which names its list", () => {
    const html = render();
    const [title = ""] = startTags(html, "h2");
    const [list = ""] = startTags(html, "ul");

    expect(elements(html, "h2").map(textOf)).toEqual(["API keys"]);
    expect(attribute(title, "data-slot")).toBe("card-title");
    expect(attribute(list, "role")).toBe("list");
    expect(attribute(list, "aria-labelledby")).toBe(attribute(title, "id"));
    expect(startTags(html, "h1")).toEqual([]);
  });

  it("is one row for each key, in the order they are given", () => {
    const rowsHtml = elements(render(), "li");

    expect(rowsHtml.map((row) => textOf(row))).toEqual([
      expect.stringContaining("Production server"),
      expect.stringContaining("Staging"),
      expect.stringContaining("Laptop"),
    ]);
  });

  it("shows the start of the key in mono, and when it was made and last used, as days", () => {
    const [first = ""] = elements(render(), "li");
    const meta = metaOf(first);
    const [code = ""] = elements(meta, "code");

    expect(textOf(code)).toBe("sk_live_AbCd…");
    expect(decodedClassesOf(startTags(meta, "code")[0] ?? "")).toContain("font-mono");
    expect(textOf(meta)).toBe("sk_live_AbCd… · Created Nov 3, 2026 · Last used Nov 5, 2026");
    // Each date is a <time> with its moment, as a day: no time zone is configured, so no hour is told
    expect(startTags(meta, "time").map((tag) => attribute(tag, "dateTime"))).toEqual([
      "2026-11-03T12:00:00.000Z",
      "2026-11-05T09:30:00.000Z",
    ]);
  });

  it("says that a key was never used, in words, where its date would be", () => {
    const [, second = ""] = elements(render(), "li");

    expect(textOf(metaOf(second))).toBe("sk_live_Qw3e… · Created Nov 3, 2026 · Never used");
    expect(startTags(metaOf(second), "time")).toHaveLength(1);
  });

  it("tells each key's status in a badge: active in the success tone, expired and revoked neutral", () => {
    const badges = elements(render(), "li").map((row) => startTags(row, "span").find((tag) => attribute(tag, "data-slot") === "badge") ?? "");
    const words = elements(render(), "li").map((row) => textOf(elements(row, "span").find((span) => span.includes('data-slot="badge"')) ?? ""));

    expect(words).toEqual(["Active", "Expired", "Revoked"]);
    expect(decodedClassesOf(badges[0] ?? "")).toContain("bg-success-bg");
    expect(decodedClassesOf(badges[1] ?? "")).toContain("bg-secondary");
    expect(decodedClassesOf(badges[2] ?? "")).toContain("bg-secondary");
  });

  it("offers the menu on every key that is not revoked, an expired one included, and on no revoked key", () => {
    expect(menusOf(render())).toEqual(["Actions for Production server", "Actions for Staging"]);
    expect(rows.map(({ label }) => label)).toEqual(["Revoke", "Revoke"]);
  });

  it("makes every menu button a 44 px control that opens a menu", () => {
    const [trigger = ""] = startTags(render(), "button");

    expect(decodedClassesOf(trigger)).toContain("tap-target");
    expect(attribute(trigger, "type")).toBe("button");
  });

  it("keeps the room of a menu in the revoked rows, when others have one, so that the badges line up", () => {
    const spacers = (html: string) =>
      elements(html, "li").map((row) => startTags(row, "span").filter((tag) => decodedClassesOf(tag).includes("size-10")).length);

    expect(spacers(render())).toEqual([0, 0, 1]);
    // Nothing is left to revoke: nobody has a menu, and there is no empty room to line up with
    expect(spacers(render([REVOKED, key({ id: "k4", status: "revoked" })]))).toEqual([0, 0]);
  });

  it("says that there is no key with an empty state under the title, and with no button: the header has the one", () => {
    const html = render([]);

    expect(html).toContain('data-slot="empty-state"');
    expect(elements(html, "h2").map(textOf)).toEqual(["API keys"]);
    expect(elements(html, "h3").map(textOf)).toEqual(["No API keys yet"]);
    expect(textOf(html)).toContain("Create a key to call the API from your own code.");
    expect(elements(html, "button")).toEqual([]);
    expect(startTags(html, "ul")).toEqual([]);
  });

  it("counts nothing itself: the header of the page says how many keys there are, once", () => {
    expect(elements(render(), "h2").map(textOf)).toEqual(["API keys"]);
    expect(textOf(render())).not.toMatch(/\(\d+\)|\b3 keys\b/);
  });

  it("speaks French", () => {
    const html = render(KEYS, "fr");
    const [first = "", second = ""] = elements(html, "li");

    expect(elements(html, "h2").map(textOf)).toEqual(["Clés d'API"]);
    expect(textOf(metaOf(first))).toBe("sk_live_AbCd… · Créée le 3 nov. 2026 · Dernière utilisation le 5 nov. 2026");
    expect(textOf(metaOf(second))).toBe("sk_live_Qw3e… · Créée le 3 nov. 2026 · Jamais utilisée");
    expect(menusOf(html)[0]).toBe("Actions pour Production server");
    expect(rows[0]?.label).toBe("Révoquer");
    expect(textOf(render([], "fr"))).toContain("Aucune clé d'API pour le moment");
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

// A key that is revoked stays in the list, and the button of its menu goes: the list is what keeps the
// focus, a box that is not a tab stop. It is drawn round the empty state too, as the box of the webhook
// endpoints is, so that the two lists stay alike and a page that swaps one for the other drops no focus.
// The stories watch the focus itself in a browser (RevokedRowKeepsTheFocus).
describe("the box that keeps the focus when a button goes", () => {
  const BOX = '<div tabindex="-1" class="focus:outline-hidden">';
  const CONTENT = '<div data-slot="card-content" class="px-5">';
  const render = (keys: ReturnType<typeof key>[]) => {
    reset();
    return renderWithIntl(<ApiKeyList orgId={ORG} keys={keys} />);
  };
  const boxesOf = (html: string) => startTags(html, "div").filter((tag) => attribute(tag, "tabindex") === "-1");

  it("holds the list when there are keys, and is the one box that is not a tab stop", () => {
    const html = render(KEYS);

    expect(boxesOf(html)).toHaveLength(1);
    expect(innerOfFirst(html, BOX)).toContain('data-slot="list"');
    expect(innerOfFirst(html, BOX)).not.toContain('data-slot="empty-state"');
  });

  it("holds the empty state when there is none, so that the swap between them does not drop the focus", () => {
    const html = render([]);

    expect(boxesOf(html)).toHaveLength(1);
    expect(innerOfFirst(html, BOX)).toContain('data-slot="empty-state"');
    expect(innerOfFirst(html, BOX)).not.toContain('data-slot="list"');
  });

  it("is the same box in both cases, the whole content of the card: only what it holds changes", () => {
    for (const html of [render(KEYS), render([])]) {
      const content = innerOfFirst(html, CONTENT);

      expect(content.startsWith(BOX)).toBe(true);
      expect(content).toBe(`${BOX}${innerOfFirst(html, BOX)}</div>`);
    }
  });
});

describe("revoking a key", () => {
  const render = (locale: Locale = "en") => {
    reset();
    confirm.calls.length = 0;
    renderWithIntl(<ApiKeyList orgId={ORG} keys={KEYS} />, locale);
  };

  /** The confirm dialog of the row that asks about this key. */
  function confirmFor(name: string) {
    const call = confirm.calls.find(({ title }) => typeof title === "string" && title.includes(name));
    expect(call, `a confirmation about ${name}`).toBeDefined();
    return call as { onConfirm: () => Promise<void>; [prop: string]: unknown };
  }

  it("asks first, in the danger tone, naming the key, with nothing to type and a button that says what it does", () => {
    render();
    const dialog = confirmFor("Production server");

    expect(dialog).toMatchObject({
      open: false,
      tone: "danger",
      title: "Revoke Production server?",
      confirmLabel: "Revoke",
    });
    expect(dialog.requireText).toBeUndefined();
    expect(String(dialog.description)).toContain("can't be undone");
    expect(typeof dialog.onCloseAutoFocus).toBe("function");
  });

  it("asks once for each key that can be revoked, and for no other", () => {
    render();

    expect(confirm.calls.map(({ title }) => title)).toEqual(["Revoke Production server?", "Revoke Staging?"]);
  });

  it("revokes the key by its own id, in the workspace, then says so and reads the page again", async () => {
    render();

    await confirmFor("Staging").onConfirm();

    expect(revokeApiKeyAction).toHaveBeenCalledExactlyOnceWith("k2", ORG);
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Key revoked: Staging");
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(vi.mocked(revokeApiKeyAction).mock.invocationCallOrder[0]).toBeLessThan(router.refresh.mock.invocationCallOrder[0] ?? 0);
  });

  it("rejects when the server does not answer, so that the dialog stays open with its error and nothing looks revoked", async () => {
    vi.mocked(revokeApiKeyAction).mockRejectedValue(new Error("offline"));
    render();

    await expect(confirmFor("Production server").onConfirm()).rejects.toThrow("offline");

    expect(toast.success).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("asks in French", () => {
    render("fr");

    expect(confirmFor("Production server")).toMatchObject({
      title: "Révoquer Production server ?",
      confirmLabel: "Révoquer",
    });
  });
});
