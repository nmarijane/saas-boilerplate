import type { FeatureShell } from "@/shared/shell/contract";
import { FeedbackNavButton } from "./components/feedback-nav-button";

// What feedback gives the shell: one row under Settings and Help, which opens
// the feedback dialog.
export const feedbackShell: FeatureShell = {
  id: "feedback",
  SidebarActions: [FeedbackNavButton],
};
