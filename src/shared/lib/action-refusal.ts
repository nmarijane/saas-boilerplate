// A refusal that an action means to give: the person asked for something the
// product does not allow (a limit of the plan, a plan that cannot be bought
// yet), which is an answer, not a failure. `safeAction` hands its `code` to the
// page, which says it in its own words; it is not logged as an error.

export class ActionRefusal extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "ActionRefusal";
    this.code = code;
  }
}

/** What a page needs to tell that a limit of the plan was reached, and where to go from there. */
export interface LimitInfo {
  /** The key of the limit in the plan (`projects`, `members`, `storage`...). */
  key: string;
  /** What the plan allows (never -1: an unlimited plan reaches nothing). */
  limit: number;
  /** What the workspace holds. */
  used: number;
  planId: string;
  planName: string;
  /** The lowest plan that allows more of it, for "Included in the {plan} plan"; null when none does. */
  includedIn?: string | null;
  /** Where the plan is changed, when there is a plan above; null when the plan is the highest. */
  upgradeHref: string | null;
}

/** The typed "limit reached" error: the action that creates something is refused on the server, whatever the page showed. */
export class PlanLimitError extends ActionRefusal {
  readonly limit: LimitInfo;

  constructor(limit: LimitInfo) {
    super("limit_reached");
    this.name = "PlanLimitError";
    this.limit = limit;
  }
}
