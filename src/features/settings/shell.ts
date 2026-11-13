import type { FeatureShell } from "@/shared/shell/contract";
import { SlidersHorizontalIcon, UserIcon } from "lucide-react";

export const settingsShell: FeatureShell = {
  id: "settings",
  nav: [
    {
      id: "settings",
      section: "secondary",
      href: "/settings/account",
      // The link stays current on every settings page, not only on Account.
      match: "/settings",
      labelKey: "shell.nav.settings",
      icon: SlidersHorizontalIcon,
      order: 10,
    },
  ],
  settings: [
    {
      id: "account",
      href: "/settings/account",
      labelKey: "settings.nav.account",
      icon: UserIcon,
      order: 10,
    },
  ],
  account: [
    {
      id: "account",
      href: "/settings/account",
      labelKey: "account.links.account",
      icon: UserIcon,
      order: 10,
    },
  ],
};
