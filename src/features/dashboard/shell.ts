import type { FeatureShell } from "@/shared/shell/contract";
import { HouseIcon } from "lucide-react";

export const dashboardShell: FeatureShell = {
  id: "dashboard",
  nav: [
    {
      id: "home",
      section: "main",
      href: "/dashboard",
      labelKey: "shell.nav.home",
      icon: HouseIcon,
      order: 10,
    },
  ],
};
