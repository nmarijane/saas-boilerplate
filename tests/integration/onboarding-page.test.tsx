import type { ShellView } from "@/shared/shell/view";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingPage from "@/app/[locale]/(app)/onboarding/page";
import { requireAuth } from "@/features/auth/guards";
import { getWorkspaceContext, requireWorkspace } from "@/features/auth/organization/workspace";
import { organization, organizationMember, user } from "@/models";
import { redirect } from "@/shared/lib/i18n-navigation";
import { shellRedirect } from "@/shared/shell/assemble";
import { seedOrg, seedOrgMember, seedUser } from "../helpers/seed";
import { fakeSession } from "../helpers/session";
import { testDb } from "../setup";

/**
 * Where a person lands, for every combination of: onboarding done or not, a
 * workspace or none, a platform admin or not, from either door (the dashboard,
 * which is where signing in leads, and onboarding itself). The two pages send
 * each other the people they cannot serve: the dashboard sends someone with no
 * workspace to onboarding, and onboarding sent anyone who had finished it to the
 * dashboard. Someone who had finished with no workspace (the seeded admin, an
 * owner who deleted their only workspace, a member who was removed) went round
 * between the two for ever. The rule is that onboarding sends to the dashboard
 * only someone who has a workspace to land in.
 *
 * What is run is the real guards and the real page, over the real database and
 * the real decision of the shell layout; a browser is played by following each
 * redirect, and counting. What is replaced is the way Next.js ends a render at a
 * redirect (it throws, to the address next-intl gives: the language in front), the
 * wizard (a stand-in that says where it starts), and the title of the page.
 */

const request = vi.hoisted(() => ({ locale: "en" }));
vi.mock("next-intl/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl/server")>()),
  getLocale: async () => request.locale,
}));
vi.mock("@/shared/lib/i18n-navigation", () => ({
  redirect: vi.fn(({ href, locale }: { href: string; locale: string }) => {
    throw new Error(`NEXT_REDIRECT:/${locale}${href}`);
  }),
}));
vi.mock("@/features/app-shell", () => ({ appPageMetadata: (title: string) => ({ title }) }));
vi.mock("@/features/onboarding/components/onboarding-wizard", () => ({
  OnboardingWizard: () => null,
}));

const PERSON = "onboarding-person";
const WORKSPACE = "onboarding-workspace";
/** More than any real journey needs: reaching it is a loop. */
const MAX_PAGES = 4;

interface Landing {
  /** The page that was drawn, after the redirects. */
  page: "/dashboard" | "/onboarding";
  /** Every page that was asked for, in order. */
  path: string[];
  /** Where the wizard starts, when the page drawn is onboarding. */
  startAt?: unknown;
}

/** What the layout of the shell does before it draws a page: sends someone with no workspace (and no admin pages to go to) to onboarding. */
async function shellLayout(): Promise<void> {
  const { workspace, user: person } = await getWorkspaceContext();
  const target = shellRedirect({
    workspace: workspace as unknown as ShellView["workspace"],
    user: person as ShellView["user"],
  });
  if (target) {
    redirect({ href: target, locale: request.locale });
  }
}

/** The page at `path`, as a browser would follow it: the redirects are followed, and a journey that does not end is a failure. */
async function visit(path: string, before: string[] = []): Promise<Landing> {
  const trail = [...before, path];
  if (trail.length > MAX_PAGES) {
    throw new Error(`Redirect loop: ${trail.join(" -> ")}`);
  }

  try {
    if (path === "/dashboard") {
      // The layout of the shell first, then the page, which asks for a workspace
      await shellLayout();
      await requireWorkspace();

      return { page: "/dashboard", path: trail };
    }

    const element = await OnboardingPage({ params: Promise.resolve({ locale: request.locale }) });

    return {
      page: "/onboarding",
      path: trail,
      startAt: isValidElement(element) ? (element.props as { startAt?: unknown }).startAt : undefined,
    };
  } catch (error) {
    const target = /^NEXT_REDIRECT:(.+)$/.exec((error as Error).message)?.[1];
    if (!target) {
      throw error;
    }
    // Every redirect names the language of the request: the browser is never sent a bare path
    expect(target.startsWith(`/${request.locale}/`), `${target} has no language`).toBe(true);

    return visit(target.slice(request.locale.length + 1), trail);
  }
}

interface Person {
  done: boolean;
  workspace: boolean;
  admin: boolean;
}

/** Signs `Person` in: the session says whether onboarding is done and whether they administer the platform; the database says whether they belong to a workspace. */
async function signIn({ done, workspace, admin }: Person) {
  await testDb.delete(organizationMember);
  await testDb.delete(organization);
  await testDb.delete(user);
  await seedUser(PERSON);
  if (workspace) {
    await seedOrg(WORKSPACE);
    await seedOrgMember(PERSON, WORKSPACE, "owner");
  }
  const session = fakeSession(PERSON, { isAdmin: admin, activeOrganizationId: workspace ? WORKSPACE : null });
  session.user.onboardingCompleted = done;
  vi.mocked(requireAuth).mockResolvedValue(session);
}

const PEOPLE: Person[] = [false, true].flatMap((done) =>
  [false, true].flatMap((workspace) => [false, true].map((admin) => ({ done, workspace, admin }))),
);

const label = ({ done, workspace, admin }: Person) =>
  `onboarding ${done ? "done" : "not done"}, ${workspace ? "a workspace" : "no workspace"}, ${admin ? "platform admin" : "not an admin"}`;

describe("where a person lands, from the dashboard and from onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.locale = "en";
  });

  it("covers every combination: eight people", () => {
    expect(PEOPLE).toHaveLength(8);
    expect(new Set(PEOPLE.map(label)).size).toBe(8);
  });

  it.each(PEOPLE.map((person) => [label(person), person] as const))(
    "never loops, and ends on a page that is drawn: %s",
    async (_, person) => {
      await signIn(person);

      for (const door of ["/dashboard", "/onboarding"]) {
        const landing = await visit(door);

        expect(landing.path.length, `from ${door}: ${landing.path.join(" -> ")}`).toBeLessThanOrEqual(3);
      }
    },
  );

  // Someone with a workspace works in it; onboarding is only for the people who have none, or who have not finished
  it.each(PEOPLE.filter(({ workspace }) => workspace).map((person) => [label(person), person] as const))(
    "lands on the dashboard from the dashboard, and from onboarding too when it is done: %s",
    async (_, person) => {
      await signIn(person);

      expect((await visit("/dashboard")).page).toBe("/dashboard");
      const fromOnboarding = await visit("/onboarding");

      expect(fromOnboarding.page).toBe(person.done ? "/dashboard" : "/onboarding");
      if (!person.done) {
        expect(fromOnboarding.startAt).toBe("profile");
      }
    },
  );

  // The people who finished onboarding and have no workspace: the seeded admin, an owner who deleted
  // their only workspace, a member who was removed. They are onboarded again, from the workspace step.
  it.each(PEOPLE.filter(({ workspace, done }) => !workspace && done).map((person) => [label(person), person] as const))(
    "onboards again, from the workspace step, someone who is done and has no workspace to land in: %s",
    async (_, person) => {
      await signIn(person);

      for (const door of ["/dashboard", "/onboarding"]) {
        const landing = await visit(door);

        expect(landing.page).toBe("/onboarding");
        expect(landing.startAt).toBe("workspace");
      }
    },
  );

  it.each(PEOPLE.filter(({ workspace, done }) => !workspace && !done).map((person) => [label(person), person] as const))(
    "onboards from the first step someone who has not done it and has no workspace: %s",
    async (_, person) => {
      await signIn(person);

      for (const door of ["/dashboard", "/onboarding"]) {
        const landing = await visit(door);

        expect(landing.page).toBe("/onboarding");
        expect(landing.startAt).toBe("profile");
      }
    },
  );

  it("asks the wizard to start where the person is, and sends nobody to the dashboard that has no workspace there", async () => {
    await signIn({ done: true, workspace: false, admin: true });

    await visit("/onboarding");

    expect(redirect).not.toHaveBeenCalledWith({ href: "/dashboard", locale: "en" });
  });

  it("names the language of the request in every redirect, in French as in English", async () => {
    request.locale = "fr";

    for (const person of PEOPLE) {
      await signIn(person);

      for (const door of ["/dashboard", "/onboarding"]) {
        // `visit` fails on a redirect that has no language in front
        expect((await visit(door)).path.length, label(person)).toBeLessThanOrEqual(3);
      }
    }
  });
});
