import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  currentLinkId,
  isAppPath,
  isWebAddress,
  navRowStyles,
} from "@/shared/components/shell/nav-row";
import { tokens } from "../../helpers/html";
import { shellLink } from "../../helpers/shell";

// The look and the rules of a row of the navigation live in a plain module, so
// that a Server Component gets them as values.

const HOME = shellLink("home", "/dashboard", "Home");
const PROJECTS = shellLink("projects", "/projects", "Projects");
// A link to the first settings page that stands for every page under /settings.
const SETTINGS = shellLink("settings", "/settings/account", "Settings", {
  match: "/settings",
});
const HELP = shellLink("help", "mailto:support@example.com", "Help");

describe("currentLinkId", () => {
  const links = [HOME, PROJECTS, SETTINGS, HELP];

  it("is the id of the link that stands for the page", () => {
    expect(currentLinkId(links, "/projects")).toBe("projects");
    expect(currentLinkId(links, "/settings/billing")).toBe("settings");
  });

  it("is nothing where no link fits, and nothing without a page", () => {
    expect(currentLinkId(links, "/billing")).toBeUndefined();
    expect(currentLinkId(links, null)).toBeUndefined();
    expect(currentLinkId([], "/projects")).toBeUndefined();
  });

  it("is never the link that leaves the app", () => {
    expect(currentLinkId([HELP], "mailto:support@example.com")).toBeUndefined();
    expect(
      currentLinkId([shellLink("docs", "https://example.com/projects", "Docs")], "/projects"),
    ).toBeUndefined();
  });

  it("is one link across the lists of the menu: a main page under /settings beats Settings", () => {
    const team = shellLink("team", "/settings/team", "Team");
    const main = [HOME, team];
    const secondary = [SETTINGS, HELP];

    // Each list on its own would name its own: Team in the first, Settings in the second.
    expect(currentLinkId(main, "/settings/team")).toBe("team");
    expect(currentLinkId(secondary, "/settings/team")).toBe("settings");
    // Over both, the more specific one is the only one.
    expect(currentLinkId([...main, ...secondary], "/settings/team")).toBe("team");
  });

  it("is the other one when the secondary link is the more specific", () => {
    const settings = shellLink("settings", "/settings", "Settings");
    const team = shellLink("team", "/settings/team", "Team");

    expect(currentLinkId([settings, team], "/settings/team/invitations")).toBe("team");
    expect(currentLinkId([team, settings], "/settings/billing")).toBe("settings");
  });

  it("is the first when two links stand for the same page", () => {
    const twin = shellLink("twin", "/projects", "Twin");

    expect(currentLinkId([PROJECTS, twin], "/projects")).toBe("projects");
    expect(currentLinkId([twin, PROJECTS], "/projects")).toBe("twin");
  });
});

describe("the kinds of href", () => {
  it.each([
    "/dashboard",
    "/",
    "/settings/team?tab=1",
    "/projects#top",
    // A backslash further on is a character of the path, and the path stays on this host.
    String.raw`/settings\team`,
  ])(
    "takes %s for a page of the app",
    (href) => {
      expect(isAppPath(href)).toBe(true);
      expect(isWebAddress(href)).toBe(false);
    },
  );

  it.each([
    "mailto:support@example.com",
    "//cdn.example.com/help",
    "https://example.com/help",
    "http://example.com",
    "tel:+3312345678",
    "dashboard",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
  ])("takes %j for a link that leaves the app", (href) => {
    expect(isAppPath(href)).toBe(false);
  });

  // A browser reads a backslash after the first slash as a second slash, so
  // that /\host is //host: a host, and not a page of the app.
  it.each([String.raw`/\evil.example`, String.raw`/\\x`, String.raw`/\/evil.example`, "/\\"])(
    "takes %s for a host, which a browser reads as //host, and not for a page of the app",
    (href) => {
      expect(isAppPath(href)).toBe(false);
      expect(isWebAddress(href)).toBe(false);
    },
  );

  it.each(["https://example.com/help", "http://example.com", "HTTPS://EXAMPLE.COM"])(
    "takes %s for a web address",
    (href) => {
      expect(isWebAddress(href)).toBe(true);
    },
  );

  it.each(["mailto:support@example.com", "//cdn.example.com/help", "/dashboard", "ftp://example.com"])(
    "does not take %s for a web address",
    (href) => {
      expect(isWebAddress(href)).toBe(false);
    },
  );
});

describe("navRowStyles", () => {
  const classes = tokens(navRowStyles);

  it("is a 44 px row with the radius of a field, which the sidebar actions share", () => {
    expect(classes).toEqual(
      expect.arrayContaining(["min-h-11", "rounded-md", "gap-2.5", "font-medium"]),
    );
  });

  it("marks the current page, and keeps the mark visible in forced-colors mode", () => {
    expect(classes).toEqual(
      expect.arrayContaining([
        "aria-[current=page]:bg-sidebar-accent",
        "aria-[current=page]:font-semibold",
        "forced-colors:aria-[current=page]:bg-[color:Highlight]",
      ]),
    );
  });
});

describe("the module itself", () => {
  const ROOT = resolve(import.meta.dirname, "../../..");
  const SRC = join(ROOT, "src");
  const ENTRY = join(SRC, "shared/components/shell/nav-row.ts");

  /** A module of the project, from what an import says, or undefined for a package. */
  function resolveImport(from: string, specifier: string): string | undefined {
    const base = specifier.startsWith("@/")
      ? join(SRC, specifier.slice(2))
      : specifier.startsWith(".")
        ? join(dirname(from), specifier)
        : undefined;
    if (!base) {
      return undefined;
    }

    return [
      `${base}.ts`,
      `${base}.tsx`,
      join(base, "index.ts"),
      join(base, "index.tsx"),
    ].find((candidate) => existsSync(candidate));
  }

  /** The modules of the project a file imports at run time: an `import type` leaves no trace. */
  function importsOf(file: string): string[] {
    const ast = ts.createSourceFile(
      file,
      readFileSync(file, "utf-8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const specifiers: string[] = [];
    for (const statement of ast.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        !statement.importClause?.isTypeOnly &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        specifiers.push(statement.moduleSpecifier.text);
      } else if (
        ts.isExportDeclaration(statement) &&
        !statement.isTypeOnly &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        specifiers.push(statement.moduleSpecifier.text);
      }
    }

    return specifiers.flatMap((specifier) => {
      const found = resolveImport(file, specifier);
      return found ? [found] : [];
    });
  }

  /** Every module of the project that a file needs, itself included. */
  function graphOf(entry: string): string[] {
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) {
        return;
      }
      seen.add(file);
      for (const next of importsOf(file)) {
        visit(next);
      }
    };
    visit(entry);

    return [...seen];
  }

  const isClientModule = (file: string) =>
    /^["']use client["']/m.test(readFileSync(file, "utf-8"));

  it("can tell a client module from a plain one", () => {
    expect(isClientModule(join(SRC, "shared/components/shell/nav-list.tsx"))).toBe(true);
    expect(isClientModule(join(SRC, "shared/utils/paths.ts"))).toBe(false);
  });

  it("follows what it imports", () => {
    expect(graphOf(ENTRY)).toEqual(
      expect.arrayContaining([ENTRY, join(SRC, "shared/utils/paths.ts")]),
    );
  });

  it("is plain, and so is everything it imports: a Server Component gets values, not client references", () => {
    const clients = graphOf(ENTRY).filter(isClientModule);

    expect(
      clients.map((file) => file.slice(ROOT.length + 1)),
      "a client module in the import graph of nav-row.ts",
    ).toEqual([]);
  });
});
