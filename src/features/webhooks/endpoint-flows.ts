import type { EventName } from "@/features/events/types";
import { unstable_rethrow } from "next/navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { isAllowedEndpointUrl } from "./endpoint-url";

// What the webhook endpoints do with the answer of the server, as plain
// functions: the server and the page are given, so that a test calls them with a
// server that refuses or does not answer (the interface cannot, in Node: it has
// no DOM to click in). The dialog and the row are the thin parts that give them
// their hands, as `project-flows.ts` does for the projects.

/** `createWebhookEndpointAction`: adds the endpoint for an admin of the workspace, and answers with its signing secret: the one time it is told. */
export type CreateEndpoint = (
  orgId: string,
  input: { url: string; events: EventName[] },
) => Promise<{ secret: string }>;

/** `toggleWebhookEndpointAction`: turns the delivery to an endpoint on or off. */
export type ToggleEndpoint = (
  endpointId: string,
  orgId: string,
  active: boolean,
) => Promise<void>;

/**
 * Whether a text is the address of an endpoint: an `https:` address, with its
 * scheme, as the events are delivered by a request over the web (`http://localhost`
 * too, in development). The server checks it again, and checks where it leads
 * when an event is delivered (`outbound.ts`).
 */
export function isEndpointUrl(text: string): boolean {
  return isAllowedEndpointUrl(text);
}

interface CreateEndpointDeps {
  create: CreateEndpoint;
  /** Reads the page again: the list behind the dialog tells the endpoint that now exists. */
  refresh: () => void;
}

/** How an addition ended: the endpoint exists (with its secret, to show once), the address is not one (nothing was sent), or the server did not take it. */
export type CreateEndpointOutcome =
  | { outcome: "created"; secret: string }
  | { outcome: "invalid" }
  | { outcome: "failed" };

/**
 * Checks the address, adds the endpoint, reads the page again, and hands the
 * signing secret to the dialog, which shows it. An address that is not one is
 * `invalid` and never reaches the server. A refusal of the server and a call
 * that fails outright (the network) are both `failed`: the dialog keeps what
 * was typed and says so. The call that fails is handled, not hidden: the error
 * reporter of the app still hears it. The secret is in no message and in no
 * log: it goes from the answer to the dialog and nowhere else, and nothing that
 * happens after the server has added the endpoint takes it from there: a page
 * that cannot be read again is told to the reporter, and the secret is still
 * shown.
 */
export async function createEndpointFlow(
  deps: CreateEndpointDeps,
  input: { orgId: string; url: string; events: EventName[] },
): Promise<CreateEndpointOutcome> {
  const url = input.url.trim();
  if (!isEndpointUrl(url)) {
    return { outcome: "invalid" };
  }

  let secret: string;
  try {
    ({ secret } = await deps.create(input.orgId, {
      url,
      events: input.events,
    }));
  } catch (error) {
    unstable_rethrow(error);
    reportHandledError(error);
    return { outcome: "failed" };
  }

  try {
    deps.refresh();
  } catch (error) {
    unstable_rethrow(error);
    reportHandledError(error);
  }

  return { outcome: "created", secret };
}

interface ToggleEndpointDeps {
  toggle: ToggleEndpoint;
}

/**
 * Turns the delivery to an endpoint on or off, and answers whether the server
 * did it. A refusal and a call that fails outright are both "no": the row puts
 * the switch back where it was, and says so. The call that fails is handled,
 * not hidden: the error reporter of the app still hears it.
 */
export async function toggleEndpointFlow(
  deps: ToggleEndpointDeps,
  input: { endpointId: string; orgId: string; active: boolean },
): Promise<boolean> {
  try {
    await deps.toggle(input.endpointId, input.orgId, input.active);
    return true;
  } catch (error) {
    unstable_rethrow(error);
    reportHandledError(error);
    return false;
  }
}
