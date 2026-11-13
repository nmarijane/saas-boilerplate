import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { InviteProblem, InviteRow } from "@/features/onboarding/components/invite-step";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { attribute, decodedClassesOf, elements, startTags, textOf } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The three steps of onboarding, drawn as they are when the page opens at each of
// them. What a send does (the calls to the server, the failure told under the field)
// is the job of the flows and of the plays of the stories: Node has no DOM to click
// in. What is replaced is what a step reaches for outside itself: the auth client, the
// server actions, and the navigation of next-intl (no Next router runs in a test).
vi.mock("@/features/auth/auth-client", () => ({
  authClient: {
    useActiveOrganization: () => ({ data: null }),
    updateUser: vi.fn(),
    organization: { setActive: vi.fn() },
    signOut: vi.fn(),
  },
  useSession: () => ({ data: { user: { name: "Camille" } } }),
}));
vi.mock("@/features/auth/organization/actions", () => ({
  createOrganization: vi.fn(),
  inviteMember: vi.fn(),
}));
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");

  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }),
    getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
    usePathname: () => "/onboarding",
    useRouter: () => ({ push: () => {}, refresh: () => {} }),
    redirect: () => undefined,
  };
});

type Locale = "en" | "fr";
type Step = "profile" | "workspace" | "invite";

const STEPS: Step[] = ["profile", "workspace", "invite"];
const TITLES: Record<Locale, Record<Step, string>> = {
  en: { profile: "Your profile", workspace: "Your workspace", invite: "Invite your team" },
  fr: { profile: "Votre profil", workspace: "Votre espace", invite: "Invitez votre équipe" },
};

const draw = (startAt: Step, locale: Locale = "en") => renderWithIntl(<OnboardingWizard startAt={startAt} />, locale);

/** What a person can read of a locale: every string of the onboarding namespace and of the strings the steps show. */
const NOT_ORGANIZATION = /organi[sz]ation/i;

describe("the steps of onboarding", () => {
  it.each(STEPS.flatMap((step) => (["en", "fr"] as const).map((locale) => [step, locale] as const)))(
    "give the step %s one h1, which is its name, in %s",
    (step, locale) => {
      const html = draw(step, locale);

      expect(elements(html, "h1")).toHaveLength(1);
      expect(textOf(elements(html, "h1")[0] ?? "")).toBe(TITLES[locale][step]);
    },
  );

  it.each(STEPS)("tell where the person is with a progress bar that has a name and says the step, on %s", (step) => {
    const html = draw(step);
    const [bar = ""] = startTags(html, "div").filter((tag) => attribute(tag, "role") === "progressbar");
    const position = STEPS.indexOf(step) + 1;

    expect(bar).not.toBe("");
    expect(attribute(bar, "aria-label")).toBe("Setup progress");
    expect(attribute(bar, "aria-valuenow")).toBe(String(position));
    expect(attribute(bar, "aria-valuemax")).toBe("3");
    expect(attribute(bar, "aria-valuetext")).toBe(`Step ${position} of 3`);
    // Said in words too, outside the bar
    expect(textOf(html)).toContain(`Step ${position} of 3`);
  });

  it("says the step in French, with the sentence the language has for it", () => {
    expect(textOf(draw("workspace", "fr"))).toContain("Étape 2 sur 3");
  });

  it("is made of the primitives of the design system: no bar of Tailwind, no title that is a div", () => {
    const html = draw("profile");

    expect(html).toContain('data-slot="progress-bar"');
    // The bar that was drawn by hand had its width written in a style attribute
    expect(html).not.toContain('style="width');
  });

  // The word of the whole app is workspace: an organization is what the library calls it
  it.each(STEPS.flatMap((step) => (["en", "fr"] as const).map((locale) => [step, locale] as const)))(
    "never say organization: the step %s in %s says workspace",
    (step, locale) => {
      expect(textOf(draw(step, locale))).not.toMatch(NOT_ORGANIZATION);
    },
  );

  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)("hold no word of organization in the messages of onboarding in %s", (_, messages) => {
    expect(JSON.stringify(messages.onboarding)).not.toMatch(NOT_ORGANIZATION);
  });
});

describe("the workspace step", () => {
  it("asks for one thing, the name: the address of a workspace is made from it, nobody picks it", () => {
    const html = draw("workspace");

    // The asterisk is the mark of a field that is required
    expect(elements(html, "label").map((label) => textOf(label).replace(/\*$/, ""))).toEqual(["Workspace name"]);
    expect(startTags(html, "input")).toHaveLength(1);
    expect(textOf(html)).not.toMatch(/slug|URL/i);
    expect(draw("workspace", "fr")).toContain("Nom de l");
  });

  it("is where it starts for someone who has done onboarding: nothing to go back to", () => {
    const html = draw("workspace");
    const buttons = elements(html, "button").map(textOf);

    expect(buttons).toContain("Next");
    expect(buttons).not.toContain("Back");
  });

  it("is quiet at rest: no error under the field, and none in English on a page in French", () => {
    for (const locale of ["en", "fr"] as const) {
      const html = draw("workspace", locale);

      expect(html).not.toContain('role="alert"');
    }
  });
});

// A placeholder is not a name: with the field filled in, or in the list of fields a screen reader jumps through, an
// e-mail field that says only "Email" cannot be told from the next one, and an icon alone names nothing
describe("the invitation step", () => {
  const row = (props: Partial<ComponentProps<typeof InviteRow>> = {}, locale: Locale = "en") =>
    renderWithIntl(
      <InviteRow
        number={1}
        invite={{ email: "", role: "member" }}
        removable={false}
        onEmail={() => {}}
        onRole={() => {}}
        onRemove={() => {}}
        {...props}
      />,
      locale,
    );

  it.each([
    ["en", "Email address of person 1"],
    ["fr", "Adresse e-mail de la personne 1"],
  ] as const)("names the e-mail field, which has only a placeholder to say what it is (%s)", (locale, name) => {
    const [field = ""] = startTags(draw("invite", locale), "input");

    expect(attribute(field, "type")).toBe("email");
    expect(attribute(field, "aria-label")).toBe(name);
  });

  it("tells the fields of the rows apart: each is named by the person it is for", () => {
    const names = [1, 2, 3].map((number) => attribute(startTags(row({ number }), "input")[0] ?? "", "aria-label"));

    expect(names).toEqual(["Email address of person 1", "Email address of person 2", "Email address of person 3"]);
    expect(new Set(names).size).toBe(3);
  });

  it("keeps the name of the field a word of what it shows: the placeholder says Email, the name starts with it", () => {
    const [field = ""] = startTags(row(), "input");

    expect(attribute(field, "placeholder")).toBe("Email");
    expect(attribute(field, "aria-label")?.toLowerCase()).toContain(attribute(field, "placeholder")?.toLowerCase());
  });

  it.each([
    ["en", "Role of person 2"],
    ["fr", "Rôle de la personne 2"],
  ] as const)("names the choice of the role, which a combobox needs to be read (%s)", (locale, name) => {
    const [trigger = ""] = startTags(row({ number: 2 }, locale), "button").filter((tag) => attribute(tag, "role") === "combobox");

    expect(attribute(trigger, "aria-label")).toBe(name);
  });

  it.each([
    ["en", 2, "Remove person 2"],
    ["fr", 3, "Retirer la personne 3"],
  ] as const)("gives the button that removes a row a name, which is its person, and hides its icon (%s)", (locale, number, name) => {
    const html = row({ number, removable: true }, locale);
    const [remove = ""] = startTags(html, "button").filter((tag) => attribute(tag, "aria-label") === name);

    expect(remove).not.toBe("");
    expect(attribute(remove, "type")).toBe("button");
    // The icon is a decoration: the name is the button's
    expect(elements(html, "button").find((button) => button.includes(name))).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("draws no remove button for the only row: there is nothing to remove it from", () => {
    expect(startTags(row({ removable: false }), "button").filter((tag) => /Remove/.test(attribute(tag, "aria-label") ?? ""))).toEqual([]);
    expect(startTags(draw("invite"), "button").filter((tag) => /Remove/.test(attribute(tag, "aria-label") ?? ""))).toEqual([]);
  });
});

describe("the profile step", () => {
  it("asks for the name, by a label, with a button that says Next", () => {
    const html = draw("profile");

    expect(elements(html, "label").map(textOf)).toEqual(["Name"]);
    expect(elements(html, "button").map(textOf)).toContain("Next");
  });

  it("checks the name itself: no tooltip of the browser, a message of the language", () => {
    expect(attribute(startTags(draw("profile"), "form")[0] ?? "", "noValidate")).toBe("");
  });
});

describe("the card of a step", () => {
  it("is the card of the sign-in pages: the same title, the same centered header", () => {
    const html = draw("profile");

    expect(decodedClassesOf(startTags(html, "h1")[0] ?? "")).toEqual(expect.arrayContaining(["text-panel", "font-semibold"]));
    expect(html).toContain('data-slot="card-description"');
  });
});

// A row that did not go stays in the list, and the step says why above its buttons: a failure of the server and an
// address that is none are not the same thing to correct, and neither is told as a success
describe("what the invitation step says when rows stay", () => {
  const alert = (problem: ComponentProps<typeof InviteProblem>["problem"], locale: Locale = "en") =>
    renderWithIntl(<InviteProblem problem={problem} />, locale);

  it("says nothing at rest", () => {
    expect(alert(null)).toBe("");
  });

  it.each([
    ["failed", "en", "We couldn't send every invitation."],
    ["invalid", "en", "Some addresses are not valid."],
    ["failed", "fr", "Nous n'avons pas pu envoyer toutes les invitations."],
    ["invalid", "fr", "Certaines adresses ne sont pas valides."],
  ] as const)("tells %s, in %s, in an alert", (problem, locale, words) => {
    const html = alert(problem, locale);

    expect(attribute(startTags(html, "div")[0] ?? "", "role")).toBe("alert");
    expect(textOf(html)).toContain(words);
  });

  it("has both sentences in both languages, each telling what to do with the rows left", () => {
    for (const messages of [en, fr]) {
      expect(messages.onboarding.invite.failed.length).toBeGreaterThan(40);
      expect(messages.onboarding.invite.invalid.length).toBeGreaterThan(40);
    }
    expect(fr.onboarding.invite.failed).not.toBe(en.onboarding.invite.failed);
    expect(fr.onboarding.invite.invalid).not.toBe(en.onboarding.invite.invalid);
  });
});
