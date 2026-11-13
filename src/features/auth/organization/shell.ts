import type { FeatureShell } from "@/shared/shell/contract";
import { UserPlusIcon, UsersIcon } from "lucide-react";
import { countMembers, countSeats } from "./queries";

// What the organization adds to the shell: the Team tab of the settings, the
// members counted against the limit of the plan (shown, and enforced when someone is invited), and the
// first step that asks an admin to invite someone. The team is more than the
// person who made the workspace: the step is done from two members.
export const organizationShell: FeatureShell = {
  id: "organization",
  settings: [
    {
      id: "team",
      href: "/settings/team",
      labelKey: "settings.nav.team",
      icon: UsersIcon,
      order: 20,
    },
  ],
  limits: [{ limitKey: "members", used: countSeats }],
  quotas: [
    {
      id: "members",
      limitKey: "members",
      labelKey: "quotas.members",
      icon: UsersIcon,
      tone: 3,
      order: 20,
      usage: ({ orgId }) => countMembers(orgId),
    },
  ],
  tasks: [
    {
      id: "invite-team",
      labelKey: "organization.task",
      icon: UserPlusIcon,
      tone: 3,
      order: 20,
      minRole: "admin",
      action: { href: "/settings/team", labelKey: "organization.taskAction" },
      isDone: async ({ orgId }) => (await countMembers(orgId)) >= 2,
    },
  ],
};
