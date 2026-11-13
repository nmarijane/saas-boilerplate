import type { ComponentProps } from "react";
import type { FeatureShell, LinkContribution } from "@/shared/shell/contract";
import { UserIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import SettingsLoading from "@/app/[locale]/(app)/(shell)/settings/loading";
import { assembleShellView } from "@/shared/shell/assemble";
import { renderWithIntl } from "../../helpers/intl";
import { USER } from "../../helpers/shell";

// The features installed are the test's: the registry is replaced by one it
// holds, and the real one is put in it for the last test. The navigation of
// next-intl is replaced (no Next router runs in a test), and the shells of the real registry
// mount components that import it: a plain anchor stands in.
const registry = vi.hoisted(() => ({ features: [] as readonly FeatureShell[] }));

vi.mock("@/features/registry", () => ({
  get FEATURES() {
    return registry.features;
  },
}));

vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...props }),
    getPathname: () => "",
    redirect: () => undefined,
    usePathname: () => "",
    useRouter: () => ({}),
  };
});

const tab = (id: string, order: number, minRole?: LinkContribution["minRole"]): LinkContribution => ({
  id,
  href: `/settings/${id}`,
  labelKey: `settings.nav.${id}`,
  icon: UserIcon,
  order,
  ...(minRole && { minRole }),
});

/** How many tabs the loading state of the settings draws. */
function tabsDrawn(): number {
  return renderWithIntl(<SettingsLoading />).match(/data-slot="page-header-skeleton-tab"/g)?.length ?? 0;
}

describe("the loading state of the settings", () => {
  // The strip of the real pages is the tabs the installed features give (the
  // shell reads them from the registry): the skeleton counts them the same way,
  // for the view with the most tabs, an admin's. A member sees fewer once the
  // page is there, and the skeleton promises one too many while it loads.
  it("draws a tab for each entry of the settings that an admin sees", () => {
    registry.features = [
      { id: "one", settings: [tab("account", 10), tab("developers", 40, "admin")] },
      { id: "two", settings: [tab("developers", 40, "admin"), tab("team", 20), tab("danger", 60, "owner")] },
      { id: "three" },
    ];

    // The tab two features give is one tab, and one for an owner alone is not an admin's
    expect(tabsDrawn()).toBe(3);
  });

  it("draws no strip when no feature gives a tab", () => {
    registry.features = [{ id: "one" }];

    expect(tabsDrawn()).toBe(0);
  });

  it("counts the tabs of the installed features as the shell does for an admin", async () => {
    const { FEATURES } = await vi.importActual<typeof import("@/features/registry")>(
      "@/features/registry",
    );
    registry.features = FEATURES;
    const workspace = { id: "org_1", name: "Studio Nord", role: "admin" as const };
    const { settings } = assembleShellView({
      snapshot: { user: USER, workspace, workspaces: [workspace] },
      features: FEATURES,
      t: (key) => key,
      plans: new Map(),
      usage: new Map(),
      productName: "Example",
      helpUrl: null,
      renderIcon: () => null,
    });

    expect(settings.length, "the tabs of the settings of an admin").toBeGreaterThan(0);
    expect(tabsDrawn()).toBe(settings.length);
  });
});
