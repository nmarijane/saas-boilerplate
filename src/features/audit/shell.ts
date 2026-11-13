import type { FeatureShell } from "@/shared/shell/contract";
import { ClipboardListIcon } from "lucide-react";
import { getWorkspaceActivity } from "./queries";

// What the audit log adds to the shell: the admin page that lists it, and the
// latest events of a workspace for its home (the first feature that gives
// activity is the one the home asks).
export const auditShell: FeatureShell = {
  id: "audit",
  nav: [
    {
      id: "audit",
      section: "admin",
      href: "/admin/audit",
      labelKey: "admin.auditLog",
      icon: ClipboardListIcon,
      order: 40,
    },
  ],
  activity: (scope, limit) => getWorkspaceActivity(scope.orgId, limit),
};
