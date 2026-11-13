"use client";

import type { ReactNode } from "react";
import type { ShellView } from "@/shared/shell/view";
import { createContext, use } from "react";

const ShellContext = createContext<ShellView | null>(null);

interface ShellProviderProps {
  view: ShellView;
  children: ReactNode;
}

// What the layout read for the signed-in person (who they are, their
// workspace, the links of the features), handed to every client component
// under the shell, so that a page does not read it twice: SettingsNav draws
// the settings tabs from it. `AppShell` mounts the provider itself.
function ShellProvider({ view, children }: ShellProviderProps) {
  return <ShellContext value={view}>{children}</ShellContext>;
}

/** The view the shell was given. It throws outside the shell: there is nothing to read there. */
function useShell(): ShellView {
  const view = use(ShellContext);
  if (view === null) {
    throw new Error(
      "useShell must be used inside the app shell: render it under <AppShell> or <ShellProvider>.",
    );
  }

  return view;
}

export { ShellProvider, useShell };
