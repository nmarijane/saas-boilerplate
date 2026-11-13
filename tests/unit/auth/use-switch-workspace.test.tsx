import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSwitchWorkspace } from "@/features/auth/organization/hooks/use-switch-workspace";
import { renderWithIntl } from "../../helpers/intl";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

// What the hook reaches for outside itself, replaced: the navigation of next-intl
// (no Next router runs in a test), the auth client (no network, no session) and
// the toast.
const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const auth = vi.hoisted(() => ({ setActive: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/shared/lib/i18n-navigation", () => ({ useRouter: () => nav }));
vi.mock("@/features/auth/auth-client", () => ({
  authClient: { organization: { setActive: auth.setActive } },
}));
vi.mock("@/shared/components/ui/sonner", () => ({ toast }));

/**
 * The hook, as a component draws it once: `switchTo` is what the component would
 * call from a click. A static render never mounts, and the state a call sets
 * afterwards is dropped, which is what this reads: the answer.
 */
function hookOf() {
  let hook: ReturnType<typeof useSwitchWorkspace> | undefined;
  function Probe() {
    hook = useSwitchWorkspace();
    return null;
  }
  renderWithIntl(<Probe />);

  if (!hook) {
    throw new Error("the hook was not called");
  }
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.setActive.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSwitchWorkspace", () => {
  it("starts with no switch running", () => {
    expect(hookOf().pendingId).toBeNull();
  });

  it("answers true once the session has the workspace, and has gone to its home", async () => {
    const switched = await hookOf().switchTo("org_2");

    expect(switched).toBe(true);
    expect(auth.setActive).toHaveBeenCalledExactlyOnceWith({ organizationId: "org_2" });
    expect(nav.push).toHaveBeenCalledExactlyOnceWith("/dashboard");
    expect(nav.refresh).toHaveBeenCalledOnce();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("goes to the page it is given in the new workspace, rather than its home", async () => {
    await expect(hookOf().switchTo("org_2", "/projects/atlas")).resolves.toBe(true);

    expect(nav.push).toHaveBeenCalledExactlyOnceWith("/projects/atlas");
    expect(nav.refresh).toHaveBeenCalledOnce();
  });

  it("answers false, says so and goes nowhere when the server refuses: Better Auth answers an error, it does not throw", async () => {
    const report = vi.fn();
    vi.stubGlobal("reportError", report);
    auth.setActive.mockResolvedValue({
      data: null,
      error: { message: "Not a member", status: 403, statusText: "Forbidden" },
    });

    const switched = await hookOf().switchTo("org_2");

    expect(switched).toBe(false);
    expect(nav.push).not.toHaveBeenCalled();
    expect(nav.refresh).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(
      "We couldn't switch workspace. Please try again.",
    );
    expect(report).toHaveBeenCalledOnce();
  });

  it("answers false, and does not reject, when the call fails outright", async () => {
    auth.setActive.mockRejectedValue(new Error("Failed to fetch"));

    await expect(hookOf().switchTo("org_2")).resolves.toBe(false);

    expect(nav.push).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledOnce();
  });
});

// `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere (the session is
// gone): the switcher must not say "we couldn't switch workspace" to a person who is on their way to sign in.
describe.each(FRAMEWORK_ERRORS)("%s from the session or the router", (_, framework) => {
  it("is handed on by the switch, which neither tells nor reports it, and goes nowhere", async () => {
    const report = vi.fn();
    vi.stubGlobal("reportError", report);
    auth.setActive.mockRejectedValue(framework);

    expect(await outcomeOf(hookOf().switchTo("org_2"))).toBe(framework);
    expect(nav.push).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it("is handed on when the router raises it after the session has the workspace", async () => {
    const report = vi.fn();
    vi.stubGlobal("reportError", report);
    nav.refresh.mockImplementation(() => {
      throw framework;
    });

    expect(await outcomeOf(hookOf().switchTo("org_2"))).toBe(framework);
    expect(toast.error).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
    nav.refresh.mockReset();
  });
});
