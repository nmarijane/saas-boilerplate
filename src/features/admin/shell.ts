import type { FeatureShell } from "@/shared/shell/contract";
import { BarChartIcon, BuildingIcon, UsersIcon } from "lucide-react";

export const adminShell: FeatureShell = {
  id: "admin",
  nav: [
    {
      id: "users",
      section: "admin",
      href: "/admin/users",
      labelKey: "admin.users",
      icon: UsersIcon,
      order: 10,
    },
    {
      id: "organizations",
      section: "admin",
      href: "/admin/organizations",
      labelKey: "admin.organizations",
      icon: BuildingIcon,
      order: 20,
    },
    {
      id: "metrics",
      section: "admin",
      href: "/admin/metrics",
      labelKey: "admin.metrics",
      icon: BarChartIcon,
      order: 30,
    },
  ],
};
