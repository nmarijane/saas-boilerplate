import type { ReactNode } from "react";
import { SignOutButton } from "@/features/onboarding/components/sign-out-button";
import { ShellLogo } from "@/shared/components/shell/logo";
import { APP_NAME } from "@/shared/config/app";

// Onboarding is outside the shell: someone who has no workspace yet has nothing
// to navigate to, so there is no sidebar, no header and no tab bar. The logo is
// there for orientation, with nowhere to go (it is not a link: home needs a
// workspace), with the one way out on the other side of the header: signing out, for a
// person who has no workspace to go to and no account menu. Over a column of 576 px
// centered in the room left.
export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-sunken">
      <header className="flex items-center justify-between gap-4 px-4 py-3 xs:px-6 lg:px-10">
        <ShellLogo productName={APP_NAME} href={null} />
        <SignOutButton />
      </header>
      <main id="main-content" className="flex flex-1 items-center px-4 pt-2 pb-12 xs:px-6">
        <div className="mx-auto w-full max-w-xl">{children}</div>
      </main>
    </div>
  );
}
