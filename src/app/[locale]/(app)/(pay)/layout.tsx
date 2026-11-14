import type { ReactNode } from "react";
import { ShellLogo } from "@/shared/components/shell/logo";
import { APP_NAME } from "@/shared/config/app";

// The pages where a plan is chosen and paid for stand outside the shell: there is
// nothing to navigate while paying, and the pages are wide (three plans side by
// side, a summary beside the form). The logo leads back to the app, which is the
// one way out; each page offers its own button otherwise.
export default function PayLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-sunken">
      <header className="flex items-center px-4 py-3 xs:px-6 lg:px-10">
        <ShellLogo productName={APP_NAME} href="/dashboard" />
      </header>
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-16 xs:px-6">
        {children}
      </main>
    </div>
  );
}
