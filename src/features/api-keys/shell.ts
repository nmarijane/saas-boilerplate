import type { FeatureShell } from "@/shared/shell/contract";
import { CodeXmlIcon, KeyRoundIcon } from "lucide-react";
import { countActiveApiKeys } from "./queries";

// What the API keys add to the shell: the Developers tab of the settings, and
// the first step that asks an admin for a key (done from one that can still be
// used: not revoked, not expired). Keys are for whoever builds on the product,
// so both are for admins.
export const apiKeysShell: FeatureShell = {
  id: "api-keys",
  settings: [
    {
      // API keys and webhooks share one tab: whichever is installed draws it.
      id: "developers",
      href: "/settings/developers",
      labelKey: "settings.nav.developers",
      icon: CodeXmlIcon,
      order: 40,
      minRole: "admin",
    },
  ],
  tasks: [
    {
      id: "api-key",
      labelKey: "apiKeys.task",
      icon: KeyRoundIcon,
      tone: 2,
      order: 30,
      minRole: "admin",
      action: { href: "/settings/developers", labelKey: "apiKeys.taskAction" },
      isDone: async ({ orgId }) => (await countActiveApiKeys(orgId)) >= 1,
    },
  ],
};
