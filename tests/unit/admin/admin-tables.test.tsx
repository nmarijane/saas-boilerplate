import type { ComponentProps } from "react";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminOrgsTable } from "@/features/admin/components/admin-orgs-table";
import { AdminUsersTable } from "@/features/admin/components/admin-users-table";
import { AuditLogTable } from "@/features/audit/components/audit-log-table";
import { ChangelogAdminTable } from "@/features/changelog/components/changelog-admin-table";
import { FlagAdminTable } from "@/features/feature-flags/components/flag-admin-table";
import { WaitlistAdminTable } from "@/features/waitlist/components/waitlist-admin-table";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import {
  attribute,
  classesOf,
  decodedClassesOf,
  elements,
  startTags,
  tagSaying,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

/**
 * The six admin tables: their words and their dates come from the messages and
 * from the formatter of the page, in the language of the page. They are client
 * components: a static render draws what the server sends first. The family's
 * rules for the tables themselves (the 48 px rows, the header style) are those
 * of the primitive: tests/unit/ui/containers.test.tsx.
 */

// The waiting list reads the page again once someone is invited; the locale-aware
// navigation of next-intl is replaced (no Next router runs in a test).
vi.mock("@/shared/lib/i18n-navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

const DAY = new Date("2026-11-04T10:00:00Z");

const users = [
  { id: "u1", name: "Ada Admin", email: "ada@example.com", isAdmin: true, emailVerified: true, createdAt: DAY },
  { id: "u2", name: "Ugo User", email: "ugo@example.com", isAdmin: false, emailVerified: false, createdAt: DAY },
];

const organizations = [
  { id: "o1", name: "Acme", slug: "acme", createdAt: DAY },
];

const logs = [
  { id: "a1", action: "project.created", resourceType: "project", resourceId: "res-1", actorId: "user-1", orgId: "org-1", createdAt: DAY },
  { id: "a2", action: "member.removed", resourceType: "member", resourceId: "res-2", actorId: null, orgId: "org-1", createdAt: DAY },
];

const changes = [
  { id: "c1", title: "Faster home", version: "1.4.0", content: "The home loads faster.", publishedAt: DAY, createdAt: DAY },
  { id: "c2", title: "Webhooks", version: null, content: "Send events to your server.", publishedAt: DAY, createdAt: DAY },
];

const flags = [
  { id: "f1", key: "new-dashboard", description: "The redesigned home", enabled: true, rules: [{ type: "plan" as const, value: "pro" }], createdAt: DAY, updatedAt: DAY },
  { id: "f2", key: "bulk-export", description: "CSV export", enabled: false, rules: [], createdAt: DAY, updatedAt: DAY },
];

type Entries = ComponentProps<typeof WaitlistAdminTable>["entries"];

const entries: Entries = [
  { id: "w1", email: "waits@example.com", referralCode: "CODE1", referralCount: 3, referredBy: null, status: "waiting", createdAt: DAY },
  { id: "w2", email: "invited@example.com", referralCode: "CODE2", referralCount: 12, referredBy: null, status: "invited", createdAt: DAY },
  { id: "w3", email: "joined@example.com", referralCode: "CODE3", referralCount: 0, referredBy: null, status: "joined", createdAt: DAY },
];

const render = (node: Parameters<typeof renderWithIntl>[0], locale: "en" | "fr" = "en") => renderWithIntl(node, locale);

/** The words of the header cells, in order. */
const headersOf = (html: string) => elements(html, "th").map(textOf);

/** The badge that says exactly this, as a start tag. */
const badge = (html: string, word: string) => tagSaying(html, "span", word);

/** The start tag of the element that carries this `data-slot`. */
const slotTag = (html: string, slot: string) =>
  new RegExp(`<[a-z0-9]+[^>]*\\sdata-slot="${slot}"[^>]*>`).exec(html)?.[0] ?? "";

/** A badge that says this, with the dot before it or not: its start tag, and whether it has the dot. */
function badgeWithDot(html: string, word: string) {
  const found = new RegExp(`(<span[^>]*data-slot="badge"[^>]*>)(<span[^>]*aria-hidden="true"[^>]*></span>)?${word}</span>`).exec(html);

  return { tag: found?.[1] ?? "", dot: found?.[2] !== undefined };
}

/** The `<time>` elements of a table: the date in words, and the moment it says. */
const timesOf = (html: string) =>
  elements(html, "time").map((time) => ({
    moment: attribute(startTags(time, "time")[0] ?? "", "dateTime"),
    words: textOf(time),
  }));

const NOTE = "This list shows the 100 newest rows out of 110. Search and sorting cover these only.";

describe("the users table", () => {
  const draw = (locale: "en" | "fr" = "en") => render(<AdminUsersTable users={users} />, locale);

  it("says an admin in the neutral tone, and a user in an outline", () => {
    const html = draw();

    expect(decodedClassesOf(badge(html, "Admin"))).toEqual(
      expect.arrayContaining(["bg-secondary", "text-secondary-foreground"]),
    );
    expect(decodedClassesOf(badge(html, "Admin"))).not.toContain("bg-brand");
    expect(decodedClassesOf(badge(html, "User"))).toEqual(expect.arrayContaining(["border-border", "text-foreground"]));
    expect(decodedClassesOf(badge(html, "User"))).not.toContain("bg-secondary");
    expect(decodedClassesOf(badge(html, "User"))).not.toContain("bg-brand");
  });

  // No colour of the brand or of a status on a page of people: what the address is, verified or not, is not the main information.
  it("says an address that is verified in an outline, and one that is not in the neutral tone", () => {
    const html = draw();

    expect(decodedClassesOf(badge(html, "Verified"))).toEqual(expect.arrayContaining(["border-border", "text-foreground"]));
    expect(decodedClassesOf(badge(html, "Verified"))).not.toContain("bg-secondary");
    expect(decodedClassesOf(badge(html, "Unverified"))).toEqual(
      expect.arrayContaining(["bg-secondary", "text-secondary-foreground"]),
    );
    for (const word of ["Admin", "User", "Verified", "Unverified"]) {
      const classes = decodedClassesOf(badge(html, word));

      expect(classes.filter((name) => /^bg-(?:brand|danger|destructive)/.test(name)), word).toEqual([]);
    }
  });

  it("takes the words of both roles from the messages", () => {
    const french = draw("fr");

    expect(badge(french, "Administrateur")).not.toBe("");
    expect(badge(french, "Utilisateur")).not.toBe("");
    expect(french).not.toContain(">Admin<");
    expect(french).not.toContain(">User<");
  });

  it("heads its columns in the language of the page", () => {
    expect(headersOf(draw())).toEqual(["Name", "Email", "Role", "Verified", "Joined"]);
    expect(headersOf(draw("fr"))).toEqual(["Nom", "Email", "Rôle", "Vérifié", "Inscrit le"]);
  });

  it("says whether an address is verified, in the language of the page", () => {
    expect(badge(draw(), "Verified")).not.toBe("");
    expect(badge(draw(), "Unverified")).not.toBe("");
    expect(badge(draw("fr"), "Vérifié")).not.toBe("");
    expect(badge(draw("fr"), "Non vérifié")).not.toBe("");
  });

  it("asks for a search in its own words, with the real ellipsis", () => {
    const [search = ""] = startTags(draw(), "input");
    const [recherche = ""] = startTags(draw("fr"), "input");

    expect(attribute(search, "placeholder")).toBe("Search users…");
    expect(attribute(recherche, "placeholder")).toBe("Rechercher un utilisateur…");
    expect(attribute(search, "aria-label")).toBe("Search users…");
  });

  // `toLocaleDateString()` reads the locale of whoever draws it, the server and
  // the browser each their own: the date goes through the formatter of the page.
  it("writes the date in the language of the page, whatever the machine that draws it", () => {
    expect(textOf(draw())).toContain("Nov 4, 2026");
    expect(textOf(draw("fr"))).toContain("4 nov. 2026");
  });

  it("says the moment of a date to the machine, in a time element", () => {
    expect(timesOf(draw())).toEqual([
      { moment: "2026-11-04T10:00:00.000Z", words: "Nov 4, 2026" },
      { moment: "2026-11-04T10:00:00.000Z", words: "Nov 4, 2026" },
    ]);
  });

  it("holds the note it is given in its card", () => {
    expect(textOf(render(<AdminUsersTable users={users} note={NOTE} />))).toContain(NOTE);
    expect(slotTag(draw(), "data-table-note")).toBe("");
  });
});

describe("the organizations table", () => {
  const draw = (locale: "en" | "fr" = "en") => render(<AdminOrgsTable organizations={organizations} />, locale);

  it("heads its columns, and asks for a search, in the language of the page", () => {
    expect(headersOf(draw())).toEqual(["Name", "Slug", "Created"]);
    expect(headersOf(draw("fr"))).toEqual(["Nom", "Slug", "Créée le"]);
    expect(attribute(startTags(draw(), "input")[0] ?? "", "placeholder")).toBe("Search organizations…");
    expect(attribute(startTags(draw("fr"), "input")[0] ?? "", "placeholder")).toBe("Rechercher une organisation…");
  });

  it("writes the date in the language of the page, in a time element", () => {
    expect(textOf(draw())).toContain("Nov 4, 2026");
    expect(textOf(draw("fr"))).toContain("4 nov. 2026");
    expect(timesOf(draw())).toEqual([{ moment: "2026-11-04T10:00:00.000Z", words: "Nov 4, 2026" }]);
  });

  it("holds the note it is given in its card", () => {
    expect(textOf(render(<AdminOrgsTable organizations={organizations} note={NOTE} />))).toContain(NOTE);
    expect(slotTag(draw(), "data-table-note")).toBe("");
  });
});

describe("the audit log table", () => {
  const draw = (locale: "en" | "fr" = "en") => render(<AuditLogTable logs={logs} />, locale);

  it("heads its columns, and asks for a search, in the language of the page", () => {
    expect(headersOf(draw())).toEqual(["Date", "Action", "Resource type", "Resource ID", "Workspace", "Actor ID"]);
    expect(headersOf(draw("fr"))).toEqual(["Date", "Action", "Type de ressource", "ID de la ressource", "Espace", "ID de l'acteur"]);
    expect(attribute(startTags(draw(), "input")[0] ?? "", "placeholder")).toBe("Search actions…");
    expect(attribute(startTags(draw("fr"), "input")[0] ?? "", "placeholder")).toBe("Rechercher une action…");
  });

  // The log keeps the time of day: two events of one day are told apart by it
  it("writes the date with the time of day, in the language of the page, in a time element", () => {
    const [english, second] = timesOf(draw());
    const [french] = timesOf(draw("fr"));

    expect(english?.moment).toBe("2026-11-04T10:00:00.000Z");
    expect(second?.moment).toBe("2026-11-04T10:00:00.000Z");
    expect(english?.words).toContain("Nov 4, 2026");
    expect(english?.words).toMatch(/10:00/);
    expect(french?.words).toContain("4 nov. 2026");
    expect(french?.words).toMatch(/10:00/);
  });

  it("says who did nothing in words, in muted text: an event nobody did is the system's", () => {
    const html = draw();
    const system = tagSaying(html, "span", "System");

    expect(system).not.toBe("");
    expect(classesOf(system)).toContain("text-ink-muted");
    expect(classesOf(system)).not.toContain("text-muted-foreground");
    expect(tagSaying(draw("fr"), "span", "Système")).not.toBe("");
  });

  it("holds the note it is given in its card", () => {
    expect(textOf(render(<AuditLogTable logs={logs} note={NOTE} />))).toContain(NOTE);
    expect(slotTag(draw(), "data-table-note")).toBe("");
  });
});

describe("the changelog table", () => {
  const draw = (locale: "en" | "fr" = "en") => render(<ChangelogAdminTable entries={changes} />, locale);

  it("heads its columns, and asks for a search, in the language of the page", () => {
    expect(headersOf(draw())).toEqual(["Published", "Version", "Title", "Content", "Actions"]);
    expect(headersOf(draw("fr"))).toEqual(["Publiée le", "Version", "Titre", "Contenu", "Actions"]);
    expect(attribute(startTags(draw(), "input")[0] ?? "", "placeholder")).toBe("Search entries…");
    expect(attribute(startTags(draw("fr"), "input")[0] ?? "", "placeholder")).toBe("Rechercher une entrée…");
  });

  it("writes the date the way the other admin rows do, in a time element", () => {
    expect(timesOf(draw())).toEqual([
      { moment: "2026-11-04T10:00:00.000Z", words: "Nov 4, 2026" },
      { moment: "2026-11-04T10:00:00.000Z", words: "Nov 4, 2026" },
    ]);
    expect(timesOf(draw("fr"))[0]?.words).toBe("4 nov. 2026");
  });

  it("says Delete on each row, in the language of the page", () => {
    expect(elements(draw(), "button").map(textOf).filter((label) => label === "Delete")).toHaveLength(2);
    expect(elements(draw("fr"), "button").map(textOf).filter((label) => label === "Supprimer")).toHaveLength(2);
  });

  // Deleting an entry takes it from the public changelog: the button asks first (a dialog, drawn once it is pressed),
  // and every row has one, so each is named by the entry it is for
  it("names the button of each row by the entry it deletes, and says that it opens a dialog, which is not open", () => {
    const deleteButtons = (html: string) => startTags(html, "button").filter((tag) => attribute(tag, "aria-haspopup") === "dialog");

    expect(deleteButtons(draw()).map((tag) => attribute(tag, "aria-label"))).toEqual(["Delete Faster home", "Delete Webhooks"]);
    expect(deleteButtons(draw("fr")).map((tag) => attribute(tag, "aria-label"))).toEqual(["Supprimer Faster home", "Supprimer Webhooks"]);
    expect(deleteButtons(draw()).map((tag) => attribute(tag, "aria-expanded"))).toEqual(["false", "false"]);
    expect(draw()).not.toContain('role="alertdialog"');
  });

  // The button that had the focus goes with its row once the entry is deleted: the table's box keeps it, as the other lists do
  it("sits in a box that takes the focus by script, as the lists do, and is no stop of the tab", () => {
    const [box = ""] = startTags(draw(), "div");

    expect(attribute(box, "tabindex")).toBe("-1");
    expect(decodedClassesOf(box)).toContain("focus:outline-hidden");
    expect(draw()).toMatch(/^<div[^>]*tabindex="-1"[^>]*><div data-slot="data-table"/);
  });

  it("mutes the version and the content in the muted ink of the family", () => {
    const html = draw();
    const none = tagSaying(html, "span", "—");

    expect(classesOf(none)).toContain("text-ink-muted");
    expect(classesOf(none)).not.toContain("text-muted-foreground");
    // The content of the entries, in the cells of the table (the search field has a muted placeholder of its own)
    expect(elements(html, "tbody").join("")).not.toContain("text-muted-foreground");
  });

  it("holds the note it is given in its card", () => {
    expect(textOf(render(<ChangelogAdminTable entries={changes} note={NOTE} />))).toContain(NOTE);
    expect(slotTag(draw(), "data-table-note")).toBe("");
  });
});

describe("the feature flags table", () => {
  const draw = (locale: "en" | "fr" = "en") => render(<FlagAdminTable flags={flags} />, locale);

  it("heads its columns, and asks for a search, in the language of the page", () => {
    expect(headersOf(draw())).toEqual(["Key", "Description", "Enabled", "Rules", "Actions"]);
    expect(headersOf(draw("fr"))).toEqual(["Clé", "Description", "Activé", "Règles", "Actions"]);
    expect(attribute(startTags(draw(), "input")[0] ?? "", "placeholder")).toBe("Search flags…");
    expect(attribute(startTags(draw("fr"), "input")[0] ?? "", "placeholder")).toBe("Rechercher un indicateur…");
  });

  it("names the switch of each flag by its key, in the language of the page", () => {
    const labels = (html: string) =>
      startTags(html, "button")
        .filter((tag) => attribute(tag, "role") === "switch")
        .map((tag) => attribute(tag, "aria-label"));

    expect(labels(draw())).toEqual(["Toggle new-dashboard", "Toggle bulk-export"]);
    expect(labels(draw("fr"))).toEqual(["Basculer new-dashboard", "Basculer bulk-export"]);
  });

  it("says Delete on each row, in the language of the page", () => {
    expect(elements(draw(), "button").map(textOf).filter((label) => label === "Delete")).toHaveLength(2);
    expect(elements(draw("fr"), "button").map(textOf).filter((label) => label === "Supprimer")).toHaveLength(2);
  });

  // Deleting a flag loses its rules and turns it off for everyone who reads it: the button asks first (a dialog, drawn
  // once it is pressed), and every row has one, so each is named by the flag it is for
  it("names the button of each row by the flag it deletes, and says that it opens a dialog, which is not open", () => {
    const deleteButtons = (html: string) => startTags(html, "button").filter((tag) => attribute(tag, "aria-haspopup") === "dialog");

    expect(deleteButtons(draw()).map((tag) => attribute(tag, "aria-label"))).toEqual(["Delete new-dashboard", "Delete bulk-export"]);
    expect(deleteButtons(draw("fr")).map((tag) => attribute(tag, "aria-label"))).toEqual(["Supprimer new-dashboard", "Supprimer bulk-export"]);
    expect(deleteButtons(draw()).map((tag) => attribute(tag, "aria-expanded"))).toEqual(["false", "false"]);
    expect(draw()).not.toContain('role="alertdialog"');
  });

  // The button that had the focus goes with its row once the flag is deleted: the table's box keeps it, as the other lists do
  it("sits in a box that takes the focus by script, as the lists do, and is no stop of the tab", () => {
    const [box = ""] = startTags(draw(), "div");

    expect(attribute(box, "tabindex")).toBe("-1");
    expect(decodedClassesOf(box)).toContain("focus:outline-hidden");
    expect(draw()).toMatch(/^<div[^>]*tabindex="-1"[^>]*><div data-slot="data-table"/);
  });

  it("has the words of its confirmation in both languages, with the flag named in each", () => {
    for (const [locale, messages] of [["en", en], ["fr", fr]] as const) {
      const table = messages.admin.flagsTable;

      for (const key of ["deleteLabel", "deleteTitle", "deleted"] as const) {
        expect(table[key], `${locale} ${key} names the flag`).toContain("{key}");
      }
      expect(table.toggleFailed.trim(), `${locale} toggleFailed`).not.toBe("");
      for (const key of ["deleteDescription", "deleteConfirm"] as const) {
        expect(table[key].trim(), `${locale} ${key}`).not.toBe("");
      }
    }
    expect(fr.admin.flagsTable.deleteConfirm).not.toBe(en.admin.flagsTable.deleteConfirm);
  });
});

describe("the waitlist table", () => {
  const draw = (locale: "en" | "fr" = "en", rows: Entries = entries) =>
    render(<WaitlistAdminTable entries={rows} />, locale);

  it("heads its columns in the language of the page", () => {
    expect(headersOf(draw())).toEqual(["Email", "Status", "Referrals", "Referral code", "Joined", "Actions"]);
    expect(headersOf(draw("fr"))).toEqual(["Email", "Statut", "Parrainages", "Code de parrainage", "Inscrit le", "Actions"]);
  });

  it("says the status of each entry in words of the language of the page", () => {
    expect(["Waiting", "Invited", "Joined"].map((word) => badgeWithDot(draw(), word).tag !== "")).toEqual([true, true, true]);
    expect(["En attente", "Invité", "Inscrit"].map((word) => badgeWithDot(draw("fr"), word).tag !== "")).toEqual([true, true, true]);
  });

  // None is coloured: the three keep three looks. Waiting is the quiet fill, invited an outline with its dot, joined an outline.
  it("gives the three statuses three looks, and none a colour", () => {
    const html = draw();
    const waiting = badgeWithDot(html, "Waiting");
    const invited = badgeWithDot(html, "Invited");
    const joined = badgeWithDot(html, "Joined");

    expect(decodedClassesOf(waiting.tag)).toEqual(expect.arrayContaining(["bg-secondary", "text-secondary-foreground"]));
    expect(waiting.dot).toBe(false);
    expect(decodedClassesOf(invited.tag)).toEqual(expect.arrayContaining(["border-border", "text-foreground"]));
    expect(invited.dot).toBe(true);
    expect(decodedClassesOf(joined.tag)).toEqual(expect.arrayContaining(["border-border", "text-foreground"]));
    expect(joined.dot).toBe(false);
    for (const { tag } of [waiting, invited, joined]) {
      expect(decodedClassesOf(tag).filter((name) => /^bg-(?:brand|danger|destructive)/.test(name))).toEqual([]);
    }
  });

  it("tells a status it does not know as it is written, rather than by a message that does not exist", () => {
    const html = draw("en", [{ ...entries[0]!, status: "bounced" }]);

    expect(badge(html, "bounced")).not.toBe("");
  });

  // The table maps three statuses; a project's locales may lack the words of one: it is told as written, and nothing throws
  it("tells a status it has no word for as it is written, though it maps it", () => {
    const messages = {
      ...en,
      admin: {
        ...en.admin,
        waitlistTable: { ...en.admin.waitlistTable, statuses: { waiting: "Waiting", invited: "Invited" } },
      },
    };
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC" onError={() => {}}>
        <WaitlistAdminTable entries={entries} />
      </NextIntlClientProvider>,
    );

    expect(badge(html, "joined")).not.toBe("");
    expect(badge(html, "Waiting")).not.toBe("");
  });

  it("offers an invitation to an entry that waits, and to no other", () => {
    expect(elements(draw(), "button").map(textOf)).toEqual(["Invite"]);
    expect(elements(draw("fr"), "button").map(textOf)).toEqual(["Inviter"]);
  });

  // Each row has an Invite button: a screen reader tells them apart by the address
  it("names each invitation by the address it is for, in the language of the page", () => {
    const [button = ""] = startTags(draw(), "button");
    const [bouton = ""] = startTags(draw("fr"), "button");

    expect(attribute(button, "aria-label")).toBe("Invite waits@example.com");
    expect(attribute(bouton, "aria-label")).toBe("Inviter waits@example.com");
  });

  // The button loads while the server answers and keeps the focus it was given: a disabled button would drop it on the page
  it("never disables the invitation: it loads, and keeps its place and its name", () => {
    const [button = ""] = startTags(draw(), "button");

    expect(attribute(button, "disabled")).toBeUndefined();
    expect(attribute(button, "data-loading")).toBeUndefined();
    expect(attribute(button, "aria-label")).toBe("Invite waits@example.com");
    expect(textOf(elements(draw(), "button")[0] ?? "")).toBe("Invite");
  });

  // Once the entry is invited the button of its row is gone: the table's box keeps the focus, as the other lists do
  it("sits in a box that takes the focus by script, as the lists do, and is no stop of the tab", () => {
    const [box = ""] = startTags(draw(), "div");

    expect(attribute(box, "tabindex")).toBe("-1");
    expect(decodedClassesOf(box)).toContain("focus:outline-hidden");
    expect(draw()).toMatch(/^<div[^>]*tabindex="-1"[^>]*><div data-slot="table-container"/);
  });

  // A 36 px button in a cell that pads 12 px above and below makes a row of 60 px, among rows of 48:
  // the cell of the action does not pad, and the 48 px floor of the row holds the height whatever the button.
  it("keeps the rows with a button and the rows without one the same height", () => {
    const cells = elements(draw(), "td");
    const action = startTags(cells.find((cell) => cell.includes("<button")) ?? "", "td")[0] ?? "";

    expect(classesOf(action)).toEqual(expect.arrayContaining(["py-0", "text-right"]));
    expect(classesOf(action)).not.toContain("py-3");
    expect(classesOf(action)).not.toContain("py-1.5");
  });

  it("says there is nothing to show, in muted text, in the language of the page", () => {
    const html = draw("en", []);
    const [cell = ""] = startTags(html, "td");

    expect(textOf(html)).toContain("No waitlist entries yet.");
    expect(textOf(draw("fr", []))).toContain("Aucune inscription pour l'instant.");
    expect(classesOf(cell)).toEqual(expect.arrayContaining(["text-center", "text-ink-muted"]));
    expect(classesOf(cell)).not.toContain("text-muted-foreground");
    expect(attribute(cell, "colSpan")).toBe("6");
  });

  it("writes the date in the language of the page, in a time element", () => {
    expect(textOf(draw())).toContain("Nov 4, 2026");
    expect(textOf(draw("fr"))).toContain("4 nov. 2026");
    expect(timesOf(draw())).toHaveLength(3);
    expect(timesOf(draw())[0]?.moment).toBe("2026-11-04T10:00:00.000Z");
  });

  // When everyone is invited the table holds no button: nothing in its box takes the focus, and a box
  // that scrolls at 390 px would be out of the keyboard's reach. The page names it by its title.
  it("makes its scroll box a region the keyboard reaches, named by the title it is given, and leaves it a plain box without one", () => {
    const named = render(<WaitlistAdminTable entries={entries} labelledBy="signups-title" />);
    const box = slotTag(named, "table-container");

    expect(attribute(box, "role")).toBe("region");
    expect(attribute(box, "aria-labelledby")).toBe("signups-title");
    expect(attribute(box, "tabindex")).toBe("0");
    expect(attribute(slotTag(draw(), "table-container"), "tabindex")).toBeUndefined();
  });

  // It sits in a card, edge to edge, under the title of the card: the text of its first and of its last column
  // is 20 px from the edge, as the title and the figures of the cards round it are, and the rules reach the edges.
  it("lines its first and its last column up with the title of the card it sits in", () => {
    const classes = decodedClassesOf(slotTag(draw(), "table"));

    expect(classes).toEqual(expect.arrayContaining(["[&_tr>:first-child]:pl-5", "[&_tr>:last-child]:pr-5"]));
  });

  it("is drawn by the primitive, so that it has the rows, the headers and the scroll of the family", () => {
    const html = draw();

    expect(html).toContain('data-slot="table-container"');
    expect(startTags(html, "th").every((head) => classesOf(head).includes("text-meta"))).toBe(true);
    expect(startTags(html, "tr").every((row) => classesOf(row).includes("h-12"))).toBe(true);
  });
});
