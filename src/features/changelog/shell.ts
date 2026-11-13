import type { FeatureShell } from "@/shared/shell/contract";
import { BookOpenIcon } from "lucide-react";

export const changelogShell: FeatureShell = {
  id: "changelog",
  nav: [
    {
      id: "changelog",
      section: "admin",
      href: "/admin/changelog",
      labelKey: "admin.changelog",
      icon: BookOpenIcon,
      order: 60,
    },
  ],
};
