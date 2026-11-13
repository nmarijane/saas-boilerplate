import type { FeatureShell } from "@/shared/shell/contract";
import { FolderIcon, FolderPlusIcon } from "lucide-react";
import { createElement } from "react";
import { NewProjectButton } from "./components/new-project-button";
import { RecentProjects } from "./components/recent-projects";
import { countProjects } from "./queries";

// What the projects add to the shell: a page in the main navigation, a quota
// counted against the limit of the plan (shown, not enforced: nothing here
// stops a workspace from creating one more), a first step of the home, the
// block of the latest projects, and the button that creates one.
export const projectsShell: FeatureShell = {
  id: "projects",
  nav: [
    {
      id: "projects",
      section: "main",
      href: "/projects",
      labelKey: "projects.nav",
      icon: FolderIcon,
      order: 20,
    },
  ],
  quotas: [
    {
      id: "projects",
      limitKey: "projects",
      labelKey: "quotas.projects",
      icon: FolderIcon,
      tone: 1,
      order: 10,
      usage: ({ orgId }) => countProjects(orgId),
    },
  ],
  tasks: [
    {
      id: "first-project",
      labelKey: "projects.task",
      icon: FolderPlusIcon,
      tone: 1,
      order: 10,
      action: { href: "/projects", labelKey: "projects.taskAction" },
      isDone: async ({ orgId }) => (await countProjects(orgId)) > 0,
    },
  ],
  homeSections: [
    { id: "recent-projects", order: 10, Component: RecentProjects },
  ],
  HomeAction: ({ scope }) =>
    createElement(NewProjectButton, { orgId: scope.orgId }),
};
