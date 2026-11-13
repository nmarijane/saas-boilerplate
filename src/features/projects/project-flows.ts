import type { z } from "zod";
import type {
  createProjectSchema,
  deleteProjectSchema,
  ProjectStatus,
  updateProjectSchema,
} from "./schemas";
import type { ActionResult } from "@/shared/lib/safe-action";
import { unstable_rethrow } from "next/navigation";
import { reportHandledError } from "@/shared/utils/report-error";

// What the forms of the projects do with the answer of the server, as plain
// functions: the server and the page are given, so that a test calls them with
// a server that refuses or does not answer (the interface cannot, in Node: it
// has no DOM to click in). Each form is the thin part that gives them to a
// component, as `create-workspace.ts` does for the workspaces.

/**
 * Runs an action for a form that keeps what was typed, and says whether it
 * worked. A refusal of the server and a call that fails outright (the network)
 * are both "no": the form stays as it is and says so, so that nothing is lost.
 * The call that fails is handled, not hidden: the error reporter of the app
 * still hears it.
 */
async function attempt<T>(run: () => Promise<ActionResult<T>>): Promise<{ done: true; data: T } | { done: false }> {
  try {
    const answer = await run();
    return answer.success ? { done: true, data: answer.data } : { done: false };
  } catch (error) {
    unstable_rethrow(error);
    reportHandledError(error);
    return { done: false };
  }
}

interface CreateProjectDeps {
  create: (input: z.infer<typeof createProjectSchema>) => Promise<ActionResult<{ id: string }>>;
  /** Closes the dialog. */
  close: () => void;
  /** Says the project exists (a toast). */
  notify: () => void;
  /** Goes to the page of the project. */
  open: (id: string) => void;
}

/**
 * Creates the project, then closes the dialog, says so and opens the project,
 * in that order. It answers whether the project was created: when it was not,
 * nothing else happens, and the dialog keeps what was typed.
 */
export async function createProjectFlow(
  deps: CreateProjectDeps,
  input: { orgId: string; name: string; description: string },
): Promise<boolean> {
  const outcome = await attempt(() =>
    deps.create({
      organizationId: input.orgId,
      name: input.name.trim(),
      description: input.description.trim(),
    }),
  );
  if (!outcome.done) {
    return false;
  }

  deps.close();
  deps.notify();
  deps.open(outcome.data.id);
  return true;
}

interface UpdateProjectDeps {
  update: (input: z.infer<typeof updateProjectSchema>) => Promise<ActionResult<void>>;
  /** Reads the page again: the header of the project and the form tell what was saved. */
  refresh: () => void;
}

/**
 * Saves the settings of the project, then reads the page again, and answers
 * whether they were saved. Every field is sent, an emptied description as
 * empty text: a field that is left out keeps its value on the server.
 */
export async function updateProjectFlow(
  deps: UpdateProjectDeps,
  input: { orgId: string; projectId: string; name: string; description: string; status: ProjectStatus },
): Promise<boolean> {
  const outcome = await attempt(() =>
    deps.update({
      organizationId: input.orgId,
      projectId: input.projectId,
      name: input.name.trim(),
      description: input.description.trim(),
      status: input.status,
    }),
  );
  if (!outcome.done) {
    return false;
  }

  deps.refresh();
  return true;
}

interface DeleteProjectDeps {
  remove: (input: z.infer<typeof deleteProjectSchema>) => Promise<ActionResult<void>>;
  /** Says the project is gone (a toast). */
  notify: () => void;
  /** Leaves the page of a project that no longer exists. */
  leave: () => void;
}

/**
 * Deletes the project, says so, then leaves its page. It rejects when the
 * project was not deleted, whether the server refused or did not answer: the
 * confirm dialog closes when this resolves, and stays open with an error toast
 * when it rejects, so a project that is still there never looks deleted.
 */
export async function deleteProjectFlow(
  deps: DeleteProjectDeps,
  input: { orgId: string; projectId: string },
): Promise<void> {
  const answer = await deps.remove({ organizationId: input.orgId, projectId: input.projectId });
  if (!answer.success) {
    throw new Error(answer.error);
  }

  deps.notify();
  // Leave at once, with no await in between: the action's answer carries this
  // page rendered again without its project (a not-found tree), and a
  // navigation started now replaces it before it is shown.
  deps.leave();
}
