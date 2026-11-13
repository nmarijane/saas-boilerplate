import type { ReactNode } from "react";
import { APP_NAME } from "@/shared/config/app";
import { ShellLogo } from "./logo";

// The frame of a page that stands alone, outside the shell: the sign-in pages,
// the not-found of a language, the error that replaces the shell. One sunken
// page, at least as high as the screen so that what it holds is centered however
// short it is, under the logo of the product, which leads home. The column is as
// wide as a card of a form can be, and no wider than the screen under it: the
// page never scrolls sideways. It is the one main landmark of its page.
export function CenteredPage({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface-sunken px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <ShellLogo productName={APP_NAME} href="/" />
        </div>
        {children}
      </div>
    </main>
  );
}
