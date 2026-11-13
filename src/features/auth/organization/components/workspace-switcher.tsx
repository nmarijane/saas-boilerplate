"use client";

import type { ReactNode } from "react";
import type { ShellWorkspace } from "@/shared/shell/view";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { InitialTile } from "@/shared/components/ui/initial-tile";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Spinner } from "@/shared/components/ui/spinner";
import { cn } from "@/shared/utils/cn";
import { useSwitchWorkspace } from "../hooks/use-switch-workspace";
import { byName } from "../workspace-search";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";

/** From this many workspaces the list has a search field: below it, the whole list is in sight. */
export const WORKSPACE_SEARCH_MIN = 6;

const hasSearch = (workspaces: readonly ShellWorkspace[]) =>
  workspaces.length >= WORKSPACE_SEARCH_MIN;

// A row of 52 px with a border, on the raised surface: the workspace switcher
// of the sidebar. It is the outline button, taller to hold two lines.
const triggerStyles =
  "h-auto min-h-13 w-full justify-start gap-2.5 bg-surface-raised p-2 text-left";

/** What is said under the name of a workspace: its plan or, when no feature gives one, the role of the person in it. */
function useWorkspaceDetail(): (workspace: ShellWorkspace) => string {
  const tAccount = useTranslations("account");
  const tOrganization = useTranslations("organization");

  return (workspace) =>
    workspace.plan
      ? tAccount("planLabel", { plan: workspace.plan })
      : tOrganization(workspace.role);
}

interface WorkspaceLabelProps {
  workspace: ShellWorkspace;
  /** What makes the name stand out: bold on the trigger, medium in the list. */
  nameStyles: string;
}

// The tile of a workspace, then its name over its plan. The tile takes its tint
// from the id, so that a rename does not repaint it. Both lines are cut when
// they do not fit: a name is not ours to choose, and the column that holds them
// can shrink below its text, which is what lets them be cut.
function WorkspaceLabel({ workspace, nameStyles }: WorkspaceLabelProps) {
  const detail = useWorkspaceDetail();

  return (
    <>
      <InitialTile name={workspace.name} seed={workspace.id} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <span className={cn("truncate", nameStyles)}>{workspace.name}</span>
        <span className="truncate text-caption font-normal text-ink-muted">
          {detail(workspace)}
        </span>
      </span>
    </>
  );
}

interface WorkspaceListProps {
  workspaces: ShellWorkspace[];
  /** The workspace the person works in, ticked; null when there is none. */
  activeId: string | null;
  /** The workspace being switched to, which shows a spinner while the others wait; null when nothing runs. */
  pendingId: string | null;
  onSelect: (workspaceId: string) => void;
  onCreate: () => void;
}

// The list of the popover: the workspaces of the person, then the row that
// creates one. A list of six or more has a search field.
//
// The create row is a row of the list, and not a button after it: cmdk moves
// among its own rows with the arrow keys, and Enter on the highlighted row
// would take the click away from a button that has the focus. It stays in sight
// at the foot of a list that scrolls, and a search never hides it.
export function WorkspaceList({
  workspaces,
  activeId,
  pendingId,
  onSelect,
  onCreate,
}: WorkspaceListProps) {
  const t = useTranslations("workspace");
  const searchable = hasSearch(workspaces);
  const busy = pendingId !== null;

  return (
    <Command
      label={t("switch")}
      // The current workspace is the one highlighted when the list opens.
      defaultValue={activeId ?? undefined}
      filter={byName}
      loop
      vimBindings={false}
      className="rounded-lg"
    >
      {searchable ? <CommandInput placeholder={t("search")} /> : null}
      <CommandList label={t("switch")}>
        {searchable ? <CommandEmpty>{t("noResults")}</CommandEmpty> : null}
        <CommandGroup>
          {workspaces.map((workspace) => {
            const current = workspace.id === activeId;
            let trailing: ReactNode = null;
            if (workspace.id === pendingId) {
              trailing = <Spinner />;
            } else if (current) {
              trailing = <CheckIcon aria-hidden="true" />;
            }

            return (
              <CommandItem
                key={workspace.id}
                value={workspace.id}
                keywords={[workspace.name]}
                data-current={current ? "" : undefined}
                // The workspace being switched to keeps its look, the others wait.
                disabled={busy && workspace.id !== pendingId}
                onSelect={() => {
                  if (!busy) {
                    onSelect(workspace.id);
                  }
                }}
              >
                <WorkspaceLabel workspace={workspace} nameStyles="font-medium" />
                {trailing}
                {current ? (
                  <span className="sr-only">{t("current")}</span>
                ) : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup forceMount className="sticky bottom-0 border-t bg-popover">
          <CommandItem value="create-workspace" disabled={busy} onSelect={onCreate}>
            <IconTile icon={PlusIcon} tone="neutral" size="sm" />
            <span className="min-w-0 flex-1 truncate">{t("create")}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

/**
 * Where the focus goes when the popover opens, for a list with no search field:
 * to the list, which is the listbox (its highlighted row is its active
 * descendant, which assistive technology reads). Nothing else in it is a tab
 * stop, and the arrow keys have to reach cmdk, which listens above the list.
 * With a search field Radix finds it, and this is not called. It is Radix that
 * asks, once the popover has taken over from whatever held the focus (a drawer
 * traps it): a `focus()` of our own, made earlier, would be undone.
 */
function focusList(event: Event) {
  event.preventDefault();
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget
      .querySelector<HTMLElement>('[role="listbox"]')
      ?.focus();
  }
}

interface WorkspaceSwitcherProps {
  /** Every workspace of the person. */
  workspaces: ShellWorkspace[];
  /** The one they work in; null when they have none. */
  activeId: string | null;
}

// The workspace switcher of the shell, a slot of the sidebar and of the drawer.
// The trigger shows the workspace the person works in, and opens a popover to
// change it or to create another. Without a workspace there is nothing to
// switch among: the trigger offers to create one, and opens the dialog.
export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: WorkspaceSwitcherProps) {
  const t = useTranslations("workspace");
  const { switchTo, pendingId } = useSwitchWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = workspaces.find(({ id }) => id === activeId);

  // The dialog is opened from a row of the popover, which is gone by then: the
  // trigger is where the focus goes back to when it closes. (A workspace
  // created takes the person to its home, and the new page owns the focus: the
  // trigger is then another element, or none, and this does nothing.)
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    trigger.current?.focus();
  };

  // The popover stays open, with its spinner, until the switch is done. The
  // workspace the person is in leads nowhere: choosing it only closes the list.
  const select = async (workspaceId: string) => {
    if (workspaceId !== activeId) {
      await switchTo(workspaceId);
    }
    setOpen(false);
  };

  const create = () => {
    setOpen(false);
    setCreating(true);
  };

  return (
    <>
      {active ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={trigger}
              type="button"
              variant="outline"
              className={triggerStyles}
            >
              <WorkspaceLabel workspace={active} nameStyles="font-semibold" />
              <ChevronsUpDownIcon aria-hidden="true" className="text-ink-muted" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label={t("switch")}
            className="w-72 max-w-[calc(100vw-2rem)] p-0"
            onOpenAutoFocus={hasSearch(workspaces) ? undefined : focusList}
          >
            <WorkspaceList
              workspaces={workspaces}
              activeId={activeId}
              pendingId={pendingId}
              onSelect={select}
              onCreate={create}
            />
          </PopoverContent>
        </Popover>
      ) : (
        <Button
          ref={trigger}
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          aria-expanded={creating}
          className={triggerStyles}
          onClick={() => setCreating(true)}
        >
          <IconTile icon={PlusIcon} tone="neutral" size="sm" />
          <span className="min-w-0 flex-1 truncate">{t("create")}</span>
        </Button>
      )}
      <CreateWorkspaceDialog
        open={creating}
        onOpenChange={setCreating}
        onCloseAutoFocus={restoreFocus}
      />
    </>
  );
}
