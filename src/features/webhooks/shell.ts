import type { FeatureShell } from "@/shared/shell/contract";
import { CodeXmlIcon } from "lucide-react";

export const webhooksShell: FeatureShell = {
  id: "webhooks",
  settings: [
    {
      // The same tab as the API keys: the first of the registry gives it, and
      // it stays when only one of the two features is installed.
      id: "developers",
      href: "/settings/developers",
      labelKey: "settings.nav.developers",
      icon: CodeXmlIcon,
      order: 40,
      minRole: "admin",
    },
  ],
};
