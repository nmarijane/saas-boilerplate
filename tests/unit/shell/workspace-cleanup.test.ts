import type { FeatureShell } from "@/shared/shell/contract";
import { describe, expect, it, vi } from "vitest";
import { runWorkspaceCleanups } from "@/shared/shell/workspace-cleanup";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

/** A feature that holds something for a workspace, and cleans it up when the workspace is deleted. */
function feature(id: string, order: number, run: (orgId: string) => Promise<string | null>): FeatureShell {
  return { id, onWorkspaceDelete: { order, run, failureKey: `${id}.failed` } };
}

describe("cleaning up a workspace before it is deleted", () => {
  it("runs the cleanup of each feature that declares one, in order, for the workspace", async () => {
    const order: string[] = [];
    const record = (name: string) => async (orgId: string) => {
      order.push(`${name}:${orgId}`);
      return name === "billing" ? "billing.subscriptionCancelled" : null;
    };

    const refused = await runWorkspaceCleanups(
      [feature("upload", 50, record("upload")), { id: "dashboard" }, feature("billing", 10, record("billing"))],
      "org_1",
    );

    expect(refused).toEqual({ failed: null, done: ["billing.subscriptionCancelled"] });
    // A step that may be refused (the subscription) runs before one that cannot be undone (the files)
    expect(order).toEqual(["billing:org_1", "upload:org_1"]);
  });

  it("stops at the first that fails, and says which: the steps after it do not run", async () => {
    const files = vi.fn(async () => null);

    const refused = await runWorkspaceCleanups(
      [
        feature("billing", 10, async () => {
          throw new Error("the provider did not answer");
        }),
        feature("upload", 50, files),
      ],
      "org_1",
    );

    expect(refused).toEqual({ failed: "billing.failed", done: [] });
    expect(files).not.toHaveBeenCalled();
  });

  // A subscription cancelled before the files failed: the person is told it is gone already
  it("says what the steps before the one that failed did", async () => {
    const refused = await runWorkspaceCleanups(
      [
        feature("billing", 10, async () => "billing.subscriptionCancelled"),
        feature("upload", 50, async () => {
          throw new Error("the storage did not answer");
        }),
      ],
      "org_1",
    );

    expect(refused).toEqual({ failed: "upload.failed", done: ["billing.subscriptionCancelled"] });
  });

  it("has nothing to do when no feature holds anything outside its rows", async () => {
    expect(await runWorkspaceCleanups([{ id: "dashboard" }, { id: "projects" }], "org_1")).toEqual({ failed: null, done: [] });
  });
});

// A redirect or a not found raised by the cleanup of a feature (a guard it calls, a page it reads) ends the action in
// Next: it is not a cleanup that failed, and the workspace is not told "kept because a cleanup failed".
describe.each(FRAMEWORK_ERRORS)("a cleanup that ends with %s", (_, framework) => {
  it("is handed on, as it is, and the steps after it do not run", async () => {
    const files = vi.fn(async () => null);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await outcomeOf(
      runWorkspaceCleanups(
        [
          feature("billing", 10, async () => {
            throw framework;
          }),
          feature("upload", 50, files),
        ],
        "org_1",
      ),
    );

    expect(outcome).toBe(framework);
    expect(files).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
    logged.mockRestore();
  });
});

