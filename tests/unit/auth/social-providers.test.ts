import { beforeEach, describe, expect, it, vi } from "vitest";
import { enabledSocialProviders } from "@/features/auth/social-providers";

// Which providers the sign-in pages draw a button for. `auth.ts` is the only
// place that decides which are on (a provider is on when its keys are set, and
// Better Auth drops the others: a click on their button answers 404); the pages
// ask what it decided, here replaced by a configuration the test writes.
const configured = vi.hoisted(() => ({ socialProviders: undefined as unknown }));

vi.mock("@/features/auth/auth", () => ({
  auth: {
    get options() {
      return { socialProviders: configured.socialProviders };
    },
  },
}));

beforeEach(() => {
  configured.socialProviders = undefined;
});

describe("the providers that sign-in can use", () => {
  it("are those whose entry is on, in the order of the buttons", () => {
    configured.socialProviders = {
      google: { clientId: "g", clientSecret: "s", enabled: true },
      github: { clientId: "h", clientSecret: "s", enabled: true },
    };

    expect(enabledSocialProviders()).toEqual(["google", "github"]);
  });

  it("keep the order of the buttons, whatever the order of the configuration", () => {
    configured.socialProviders = { github: { enabled: true }, google: { enabled: true } };

    expect(enabledSocialProviders()).toEqual(["google", "github"]);
  });

  it("leave out a provider that is off", () => {
    configured.socialProviders = { google: { enabled: false }, github: { enabled: true } };

    expect(enabledSocialProviders()).toEqual(["github"]);
  });

  it("are none when every provider is off, which is an install with no OAuth keys", () => {
    configured.socialProviders = { google: { enabled: false }, github: { enabled: false } };

    expect(enabledSocialProviders()).toEqual([]);
  });

  it("count an entry as on only when it says so: none that does not say, none that says anything else", () => {
    configured.socialProviders = { google: { clientId: "g" }, github: { enabled: "yes" } };

    expect(enabledSocialProviders()).toEqual([]);
  });

  it("leave out a provider that is on but has no button here", () => {
    configured.socialProviders = { discord: { enabled: true }, github: { enabled: true } };

    expect(enabledSocialProviders()).toEqual(["github"]);
  });

  it("are none when there is no configuration at all", () => {
    configured.socialProviders = undefined;

    expect(enabledSocialProviders()).toEqual([]);
  });
});
