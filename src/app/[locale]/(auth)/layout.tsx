import type { ReactNode } from "react";
import { CenteredPage } from "@/shared/components/shell/centered-page";

// The sign-in pages are one card on a sunken page, in the middle of the screen
// (and at least as high as it, so that the card is centered however short it
// is), under the logo of the product, which leads home. The column is as wide
// as a card of a form can be, and as wide as the screen under it: the page
// never scrolls sideways.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <CenteredPage>{children}</CenteredPage>;
}
