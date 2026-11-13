import type { ReactNode, Ref } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/shared/components/ui/card";

interface AuthCardProps {
  /** The one `h1` of the page. */
  title: string;
  /** One sentence under the title, muted: what the page is for. */
  description?: string;
  /** A picture for the card, centered above the title: an `IconTile`. It is decoration, the title says what the card is. */
  icon?: ReactNode;
  /** The form, or what the page has to say. A card that only says something (a title, a sentence, a way on) has none. */
  children?: ReactNode;
  /** One line under the body: text and `TextLink`s that lead somewhere else. */
  footer?: ReactNode;
  /**
   * For a card whose title changes under the person (the steps of onboarding):
   * the h1 can take the focus by script, so that a screen reader says where they
   * are. It is never a tab stop and draws no ring (it is not a control).
   */
  headingRef?: Ref<HTMLHeadingElement>;
}

// The card of a sign-in page, centered under the logo by the layout around it.
// It holds the one h1 of the page (the primitives of the card draw a div, or a
// heading of level 2 or 3, as the h1 of an app page is its header's): in the
// panel size, semibold, with its picture above it if it has one and its muted
// sentence under it, then the body, then a footer set apart by a hairline. The
// heading and the footer are centered, the fields are not.
export function AuthCard({
  title,
  description,
  icon,
  children,
  footer,
  headingRef,
}: AuthCardProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        {icon ? (
          <div data-slot="auth-card-icon" className="flex justify-center pb-2.5">
            {icon}
          </div>
        ) : null}
        <h1
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className={headingRef ? "text-panel font-semibold focus:outline-hidden" : "text-panel font-semibold"}
        >
          {title}
        </h1>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
      {footer ? (
        <CardFooter className="justify-center border-t border-hairline">
          <p className="text-center text-body text-ink-muted">{footer}</p>
        </CardFooter>
      ) : null}
    </Card>
  );
}
