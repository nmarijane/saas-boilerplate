import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createProjectFlow,
  deleteProjectFlow,
  updateProjectFlow,
} from "@/features/projects/project-flows";
import { FRAMEWORK_ERRORS, outcomeOf } from "../../helpers/next-errors";

// What the forms of the projects do with the answer of the server, as plain
// functions: a server that refuses or does not answer is an outcome here, and
// a test calls it with the server it wants (the interface cannot, in Node: it
// has no DOM to click in).

afterEach(() => {
  vi.unstubAllGlobals();
});

const created = { success: true, data: { id: "p9" } } as const;
const done = { success: true, data: undefined } as const;
const refused = { success: false, error: "Failed" } as const;

/** What the error reporter of the page is told. */
function reporter() {
  const report = vi.fn();
  vi.stubGlobal("reportError", report);
  return report;
}

describe("createProjectFlow", () => {
  const input = { orgId: "org_1", name: "Atlas", description: "" };

  it("creates the project, then closes the dialog, says so and opens the project, in that order", async () => {
    const calls: string[] = [];

    const result = await createProjectFlow(
      {
        create: async (sent) => {
          calls.push(`create:${sent.organizationId}:${sent.name}`);
          return created;
        },
        close: () => calls.push("close"),
        notify: () => calls.push("notify"),
        open: (id) => calls.push(`open:${id}`),
      },
      input,
    );

    expect(result).toBe(true);
    expect(calls).toEqual(["create:org_1:Atlas", "close", "notify", "open:p9"]);
  });

  it("sends the name and the description without the spaces around them", async () => {
    const create = vi.fn(async () => created);

    await createProjectFlow(
      { create, close: vi.fn(), notify: vi.fn(), open: vi.fn() },
      { orgId: "org_1", name: "  Atlas  ", description: "  The first one \n" },
    );

    expect(create).toHaveBeenCalledWith({
      organizationId: "org_1",
      name: "Atlas",
      description: "The first one",
    });
  });

  it("does nothing else when the server refuses, and says it did not work", async () => {
    const deps = { create: vi.fn(async () => refused), close: vi.fn(), notify: vi.fn(), open: vi.fn() };
    const report = reporter();

    expect(await createProjectFlow(deps, input)).toBe(false);

    expect(deps.close).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
    expect(deps.open).not.toHaveBeenCalled();
    // A refusal is an answer, not an exception: there is nothing to report
    expect(report).not.toHaveBeenCalled();
  });

  it("does the same when the call fails outright, and the error reporter still hears it", async () => {
    const failure = new Error("Failed to fetch");
    const deps = {
      create: vi.fn(async () => {
        throw failure;
      }),
      close: vi.fn(),
      notify: vi.fn(),
      open: vi.fn(),
    };
    const report = reporter();

    await expect(createProjectFlow(deps, input)).resolves.toBe(false);

    expect(report).toHaveBeenCalledExactlyOnceWith(failure);
    expect(deps.close).not.toHaveBeenCalled();
    expect(deps.open).not.toHaveBeenCalled();
  });
});

describe("updateProjectFlow", () => {
  const input = {
    orgId: "org_1",
    projectId: "p1",
    name: "Atlas",
    description: "The first one",
    status: "active",
  } as const;

  it("saves, then reads the page again so that the header and the form tell what was saved", async () => {
    const calls: string[] = [];

    const result = await updateProjectFlow(
      {
        update: async () => {
          calls.push("update");
          return done;
        },
        refresh: () => calls.push("refresh"),
      },
      input,
    );

    expect(result).toBe(true);
    expect(calls).toEqual(["update", "refresh"]);
  });

  it("sends every field, trimmed", async () => {
    const update = vi.fn(async () => done);

    await updateProjectFlow(
      { update, refresh: vi.fn() },
      { ...input, name: " Atlas 2 ", description: " Changed ", status: "draft" },
    );

    expect(update).toHaveBeenCalledWith({
      organizationId: "org_1",
      projectId: "p1",
      name: "Atlas 2",
      description: "Changed",
      status: "draft",
    });
  });

  it("sends an emptied description as empty text: a field that is left out keeps its value", async () => {
    const update = vi.fn(async () => done);

    await updateProjectFlow({ update, refresh: vi.fn() }, { ...input, description: "   " });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ description: "" }));
  });

  it("does not read the page again when the server refuses", async () => {
    const refresh = vi.fn();

    expect(await updateProjectFlow({ update: async () => refused, refresh }, input)).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("answers false, and tells the error reporter, when the call fails outright", async () => {
    const failure = new Error("Failed to fetch");
    const refresh = vi.fn();
    const report = reporter();

    const result = await updateProjectFlow(
      {
        update: async () => {
          throw failure;
        },
        refresh,
      },
      input,
    );

    expect(result).toBe(false);
    expect(report).toHaveBeenCalledExactlyOnceWith(failure);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("deleteProjectFlow", () => {
  const input = { orgId: "org_1", projectId: "p1" };

  it("deletes the project, says so, then leaves the page of a project that is gone", async () => {
    const calls: string[] = [];

    await deleteProjectFlow(
      {
        remove: async (sent) => {
          calls.push(`remove:${sent.organizationId}:${sent.projectId}`);
          return done;
        },
        notify: () => calls.push("notify"),
        leave: () => calls.push("leave"),
      },
      input,
    );

    expect(calls).toEqual(["remove:org_1:p1", "notify", "leave"]);
  });

  // The confirm dialog closes when this resolves, and stays open, with an error
  // toast, when it rejects: a project that was not deleted must not look deleted.
  it("rejects when the server refuses, and neither says so nor leaves", async () => {
    const deps = { remove: vi.fn(async () => refused), notify: vi.fn(), leave: vi.fn() };

    await expect(deleteProjectFlow(deps, input)).rejects.toThrow("Failed");

    expect(deps.notify).not.toHaveBeenCalled();
    expect(deps.leave).not.toHaveBeenCalled();
  });

  it("lets a call that fails outright reject as it is", async () => {
    const failure = new Error("Failed to fetch");
    const deps = {
      remove: vi.fn(async () => {
        throw failure;
      }),
      notify: vi.fn(),
      leave: vi.fn(),
    };

    await expect(deleteProjectFlow(deps, input)).rejects.toBe(failure);

    expect(deps.notify).not.toHaveBeenCalled();
    expect(deps.leave).not.toHaveBeenCalled();
  });
});

// `redirect()` and `notFound()` throw errors that Next catches higher up, to send the person elsewhere (the session is
// gone, the role is too low): a form must not keep what was typed and say "failed" for a person who is on their way
// to the sign-in page, nor report it.
describe.each(FRAMEWORK_ERRORS)("%s from the server", (_, framework) => {
  const reject = async () => {
    throw framework;
  };

  it("is handed on by the form that creates a project, which closes and says nothing", async () => {
    const report = reporter();
    const calls: string[] = [];

    const outcome = await outcomeOf(
      createProjectFlow(
        { create: reject, close: () => calls.push("close"), notify: () => calls.push("notify"), open: () => calls.push("open") },
        { orgId: "org_1", name: "Atlas", description: "" },
      ),
    );

    expect(outcome).toBe(framework);
    expect(calls).toEqual([]);
    expect(report).not.toHaveBeenCalled();
  });

  it("is handed on by the form that saves the settings, which reads nothing again", async () => {
    const report = reporter();
    const refresh = vi.fn();

    const outcome = await outcomeOf(
      updateProjectFlow({ update: reject, refresh }, { orgId: "org_1", projectId: "p1", name: "Atlas", description: "", status: "active" }),
    );

    expect(outcome).toBe(framework);
    expect(refresh).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it("is handed on by the deletion, which says nothing and leaves nothing: the confirmation hands it on in its turn", async () => {
    const notify = vi.fn();
    const leave = vi.fn();

    const outcome = await outcomeOf(deleteProjectFlow({ remove: reject, notify, leave }, { orgId: "org_1", projectId: "p1" }));

    expect(outcome).toBe(framework);
    expect(notify).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();
  });
});
