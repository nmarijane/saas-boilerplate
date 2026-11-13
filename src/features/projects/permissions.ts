import type { OrgRole } from "@/shared/types";
import { isVisible } from "@/shared/shell/resolve";

// One role gates the deletion of a project, and it is written once: the server
// asks it of `requireRole` in `deleteProject`, and the settings page offers the
// zone to the roles at least as high, by the rule the shell uses for its own
// links (`isVisible`: owner above admin above member), not by a ranking of its
// own. The page only hides what a role cannot do; the server decides again.

/** The lowest role that may delete a project. */
export const DELETE_MIN_ROLE: OrgRole = "admin";

/** Whether a role is offered the zone that deletes a project. */
export function canDeleteProject(role: OrgRole): boolean {
  return isVisible(
    { minRole: DELETE_MIN_ROLE },
    { role, isPlatformAdmin: false },
  );
}
