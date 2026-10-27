"use client";

import type {NavGroup} from "@ai-chambers/design-system";
import { AppShell  } from "@ai-chambers/design-system";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { usePathname } from "@/shared/lib/i18n-navigation";

const LOCALE_PREFIX_RE = /^\/(en|fr)/;

interface WorkspaceShellProps {
  children: React.ReactNode;
  workspace: string;
  nav: NavGroup[];
}

export function WorkspaceShell({
  children,
  workspace,
  nav,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const cleanPath = pathname.replace(LOCALE_PREFIX_RE, "") || "/dashboard";
  const theme: "light" | "dark" =
    mounted && resolvedTheme === "dark" ? "dark" : "light";

  // Find the nav href that best matches the current path (longest prefix match).
  const allHrefs = nav.flatMap((g) => g.items.map((i) => i.href));
  const current =
    allHrefs
      .filter((href) => cleanPath.startsWith(href))
      .sort((a, b) => b.length - a.length)[0] ?? cleanPath;

  return (
    <AppShell
      workspace={workspace}
      nav={nav}
      current={current}
      theme={theme}
      onThemeChange={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {children}
    </AppShell>
  );
}
