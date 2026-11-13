import { FeedbackButton } from "./feedback-button";

// The feedback row of the sidebar and of the drawer: what the shell mounts
// (`SidebarActions` takes components with no props), so it is the navigation
// variant of the button, ready made.
export function FeedbackNavButton() {
  return <FeedbackButton variant="nav" />;
}
