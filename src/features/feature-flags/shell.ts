import type { FeatureShell } from "@/shared/shell/contract";
import { FlagIcon } from "lucide-react";

export const featureFlagsShell: FeatureShell = {
  id: "feature-flags",
  nav: [
    {
      id: "feature-flags",
      section: "admin",
      href: "/admin/features",
      labelKey: "admin.featureFlags",
      icon: FlagIcon,
      order: 50,
    },
  ],
};
