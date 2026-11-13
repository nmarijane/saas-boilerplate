"use client";

import type {
  ShellLink,
  ShellQuota,
  ShellUser,
  ShellWorkspace,
} from "@/shared/shell/view";
import {
  ArrowLeftRightIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  LanguagesIcon,
  LogOutIcon,
  SunMoonIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { hasLocale, useFormatter, useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import { useId } from "react";
import { useSignOut } from "@/features/auth/hooks/use-sign-out";
import { useSwitchWorkspace } from "@/features/auth/organization/hooks/use-switch-workspace";
import { ShellAnchor } from "@/shared/components/shell/nav-list";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { InitialTile } from "@/shared/components/ui/initial-tile";
import { ProgressBar } from "@/shared/components/ui/progress-bar";
import { usePathname, useRouter } from "@/shared/lib/i18n-navigation";
import { routing } from "@/shared/lib/i18n-routing";
import { needsAttention } from "@/shared/shell/resolve";
import { withSearch } from "@/shared/utils/paths";

// A row of the sidebar, as tall as the workspace switcher above it: a 32 px
// avatar and two lines. The account is the quiet one of the two, so it has no
// border: the pointer lightens it, as it does a row of the navigation.
const triggerStyles = "h-auto min-h-13 w-full justify-start gap-2.5 p-2 text-left";

// Rows of the menu are 44 px high, where the shared row is 40: the menu is
// opened by a finger on a phone, in the drawer.
const itemStyles = "min-h-11";

/** A person with no name is shown by their e-mail, as a row of blank is no row. */
function displayName(user: ShellUser): string {
  return user.name.trim() || user.email;
}

// The photo of the person in a 32 px circle; until it loads, or when there is
// none, a tile of initials tinted from their id (a rename does not repaint it).
// It is a picture: the name next to it is who it is.
function UserAvatar({ user }: { user: ShellUser }) {
  const tile = (
    <InitialTile
      name={displayName(user)}
      seed={user.id}
      size="sm"
      className="rounded-full"
    />
  );

  if (!user.image) {
    return tile;
  }

  return (
    <Avatar>
      <AvatarImage src={user.image} alt="" />
      <AvatarFallback className="bg-transparent">{tile}</AvatarFallback>
    </Avatar>
  );
}

interface AccountSummaryProps {
  /** The id of the summary, for what is described by it (the menu it opens in). */
  id?: string;
  user: ShellUser;
  /** The workspace the person works in; its plan is told when it has one. */
  workspace: ShellWorkspace | null;
  /** The quotas of that workspace: only those that need attention are detailed. */
  quotas: ShellQuota[];
}

// The head of the menu: who is signed in, the plan of the workspace, and the
// quotas that are running low or reached (those at their limit first). A quota
// that is fine has no business here: the home shows them all.
//
// A menu owns items, and a bar is none: left to assistive technology, a menu
// with a progressbar in it is a menu with a child it must not have. The bar
// only repeats what is written beside it (the figures, with their unit, and the
// state in words), so it is drawn for the eye and hidden from the rest. It is
// still given its name and its `valueText`, as a bar must be, should the
// wrapper that hides it ever go.
export function AccountSummary({
  id,
  user,
  workspace,
  quotas,
}: AccountSummaryProps) {
  const t = useTranslations("account");
  const tQuotas = useTranslations("quotas");
  const format = useFormatter();
  const name = displayName(user);
  const attention = needsAttention(quotas);

  // A figure carries its unit: a bare 3,200 does not say what it counts.
  const figure = (quota: ShellQuota, value: number) =>
    format.number(
      value,
      quota.unit ? { style: "unit", unit: quota.unit } : undefined,
    );

  return (
    <div id={id} className="flex flex-col gap-3 px-3 py-2">
      <div className="flex min-w-0 flex-col leading-snug">
        <p className="truncate font-semibold text-ink">{name}</p>
        {name === user.email ? null : (
          <p className="truncate text-meta text-ink-muted">{user.email}</p>
        )}
      </div>
      {workspace?.plan ? (
        // The name is the one that is cut when the row is short: the plan is what
        // the line is for, and is never hidden by a long name.
        <p className="flex min-w-0 gap-1 text-meta text-ink-muted">
          <span className="truncate">{workspace.name}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">
            {t("planLabel", { plan: workspace.plan })}
          </span>
        </p>
      ) : null}
      {attention.map((quota) => {
        const used = figure(quota, quota.used);
        const limit = figure(quota, quota.limit);

        return (
          <div key={quota.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-meta">
              <span className="min-w-0 truncate font-medium text-ink">
                {quota.label}
              </span>
              <span className="shrink-0 text-ink-muted">
                {used} {tQuotas("of", { limit })}
              </span>
            </div>
            <div aria-hidden="true">
              <ProgressBar
                value={quota.used}
                max={quota.limit}
                label={quota.label}
                valueText={tQuotas("valueText", { used, limit })}
              />
            </div>
            {quota.status === "limit" ? (
              <Badge variant="danger">{tQuotas("limitReached")}</Badge>
            ) : (
              <Badge variant="warning">
                <TriangleAlertIcon />
                {tQuotas("runningLow")}
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

const THEMES = ["light", "dark", "system"] as const;

// Light, dark, or the one of the device. next-themes keeps the choice and
// puts the class on <html>. It does not know the theme until it has mounted:
// the group is read when the menu opens, which is after.
function ThemeMenu() {
  const t = useTranslations("account.theme");
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={itemStyles}>
        <SunMoonIcon />
        {t("label")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          {THEMES.map((name) => (
            <DropdownMenuRadioItem
              key={name}
              value={name}
              className={itemStyles}
            >
              {t(name)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

// The language of the app, each in its own words: someone who cannot read the
// current one must still find theirs. The same page, in the other language, with
// its query: the filters of a list, the tab of a page, stay where they were. A
// project that adds a locale to the routing adds its name under
// `account.language`, in every message file.
function LanguageMenu() {
  const t = useTranslations("account.language");
  const locale = useLocale();
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={itemStyles}>
        <LanguagesIcon />
        {t("label")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(next) => {
            if (hasLocale(routing.locales, next)) {
              router.replace(withSearch(pathname, search), { locale: next });
            }
          }}
        >
          {routing.locales.map((code) => (
            <DropdownMenuRadioItem
              key={code}
              value={code}
              lang={code}
              className={itemStyles}
            >
              {t(code)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

interface WorkspaceMenuProps {
  workspaces: ShellWorkspace[];
  activeId: string | null;
}

// The other workspaces, for someone who has more than one: the same switch as
// the popover of the sidebar, a tap away from the account. The one the person
// works in is ticked and leads nowhere.
function WorkspaceMenu({ workspaces, activeId }: WorkspaceMenuProps) {
  const t = useTranslations("workspace");
  const { switchTo } = useSwitchWorkspace();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={itemStyles}>
        <ArrowLeftRightIcon />
        {t("switch")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-64 max-w-[calc(100vw-2rem)]">
        {workspaces.map((workspace) => {
          const current = workspace.id === activeId;

          return (
            <DropdownMenuItem
              key={workspace.id}
              className={itemStyles}
              onSelect={() => {
                if (!current) {
                  void switchTo(workspace.id);
                }
              }}
            >
              <InitialTile name={workspace.name} seed={workspace.id} size="sm" />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {current ? (
                <>
                  <CheckIcon aria-hidden="true" />
                  <span className="sr-only">{t("current")}</span>
                </>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

interface AccountMenuProps {
  user: ShellUser;
  workspace: ShellWorkspace | null;
  /** Every workspace of the person: the menu offers to switch when there is more than one. */
  workspaces: ShellWorkspace[];
  /** The links the features give to the account (Account, Billing...). */
  links: ShellLink[];
  quotas: ShellQuota[];
}

// The account menu of the shell, a slot at the foot of the sidebar and of the
// drawer. The trigger is the person (their avatar, their name and their role in
// the workspace, or their e-mail when there is none); the menu opens upward and
// holds, in this order: who they are and what runs low, the links of the
// features, theme and language, the switch of workspace, and sign out.
//
// A menu is read row by row, and the summary is no row: with the bars of its
// quotas hidden from assistive technology (see `AccountSummary`), someone who
// uses a screen reader would never hear that a limit is near. The menu is
// described by the summary, which is read when it opens.
export function AccountMenu({
  user,
  workspace,
  workspaces,
  links,
  quotas,
}: AccountMenuProps) {
  const t = useTranslations("account");
  const tOrganization = useTranslations("organization");
  const summaryId = useId();
  const signOut = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" className={triggerStyles}>
          <UserAvatar user={user} />
          <span className="flex min-w-0 flex-1 flex-col leading-snug">
            <span className="truncate font-medium">{displayName(user)}</span>
            <span className="truncate text-caption font-normal text-ink-muted">
              {workspace ? tOrganization(workspace.role) : user.email}
            </span>
          </span>
          <ChevronsUpDownIcon aria-hidden="true" className="text-ink-muted" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        aria-describedby={summaryId}
        className="w-72 max-w-[calc(100vw-1rem)]"
      >
        <AccountSummary
          id={summaryId}
          user={user}
          workspace={workspace}
          quotas={quotas}
        />
        <DropdownMenuSeparator />
        {links.map((link) => (
          <DropdownMenuItem key={link.id} asChild className={itemStyles}>
            <ShellAnchor link={link}>
              {link.icon}
              <span className="min-w-0 flex-1 truncate">{link.label}</span>
            </ShellAnchor>
          </DropdownMenuItem>
        ))}
        {links.length > 0 ? <DropdownMenuSeparator /> : null}
        <ThemeMenu />
        <LanguageMenu />
        {workspaces.length > 1 ? (
          <WorkspaceMenu
            workspaces={workspaces}
            activeId={workspace?.id ?? null}
          />
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={itemStyles}
          onSelect={() => void signOut()}
        >
          <LogOutIcon />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
