import type { ReactNode } from "react";
import { getShell } from "@/features/app-shell";
import { AccountMenu } from "@/features/auth/components/account-menu";
import { WorkspaceSwitcher } from "@/features/auth/organization/components/workspace-switcher";
import { AppShell } from "@/shared/components/shell/app-shell";
import { redirect } from "@/shared/lib/i18n-navigation";
import { shellRedirect } from "@/shared/shell/assemble";

// The frame of the connected space, drawn once for every page under it. It
// reads the person and what the installed features declare (`getShell`), sends
// someone with no workspace to onboarding, then draws the shell around the page,
// inside the providers the features ask for (the first of the registry is the
// outermost). The workspace switcher and the account menu are the slots of the
// auth feature: they are given the workspaces and the person the view holds,
// and nothing is read again.
export default async function ShellLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { view, Providers, Notifications, SidebarActions } = await getShell();

  const target = shellRedirect(view);
  if (target) {
    const { locale } = await params;
    redirect({ href: target, locale });
  }

  const shell = (
    <AppShell
      view={view}
      workspaceSwitcher={
        <WorkspaceSwitcher
          workspaces={view.workspaces}
          activeId={view.workspace?.id ?? null}
        />
      }
      accountMenu={
        <AccountMenu
          user={view.user}
          workspace={view.workspace}
          workspaces={view.workspaces}
          links={view.account}
          quotas={view.quotas}
        />
      }
      notifications={Notifications ? <Notifications /> : undefined}
      sidebarActions={SidebarActions.map((Action, index) => (
        <Action key={index} />
      ))}
    >
      {children}
    </AppShell>
  );

  return Providers.reduceRight<ReactNode>(
    (tree, Provider) => <Provider>{tree}</Provider>,
    shell,
  );
}
