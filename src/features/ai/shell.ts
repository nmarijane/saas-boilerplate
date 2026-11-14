import type { FeatureShell } from "@/shared/shell/contract";
import { BotIcon, ZapIcon } from "lucide-react";
import { AI_CREDITS_QUOTA_ID } from "./config/credits";
import { allocationUsed } from "./service";

// What the assistant adds to the shell: a page in the main navigation, and the
// credits the workspace has used of this month's allocation, counted against
// the limit of the plan (the chat route refuses at zero).
export const aiShell: FeatureShell = {
  id: "ai",
  nav: [
    {
      id: "assistant",
      section: "main",
      href: "/ai",
      labelKey: "ai.nav",
      icon: BotIcon,
      order: 30,
    },
  ],
  quotas: [
    {
      id: AI_CREDITS_QUOTA_ID,
      limitKey: "aiCredits",
      labelKey: "quotas.aiCredits",
      icon: ZapIcon,
      tone: 2,
      order: 40,
      usage: ({ orgId }) => allocationUsed(orgId),
    },
  ],
};
