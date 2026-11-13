import type { FeatureShell } from "@/shared/shell/contract";
import { ListOrderedIcon } from "lucide-react";

export const waitlistShell: FeatureShell = {
  id: "waitlist",
  nav: [
    {
      id: "waitlist",
      section: "admin",
      href: "/admin/waitlist",
      labelKey: "admin.waitlist",
      icon: ListOrderedIcon,
      order: 70,
    },
  ],
};
