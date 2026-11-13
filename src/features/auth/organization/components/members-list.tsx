"use client";

import type { OrgRole } from "@/shared/types";
import { CrownIcon, EllipsisIcon, LogOutIcon, UserMinusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { useId, useRef, useState } from "react";
import {
  changeRole,
  leaveWorkspace,
  removeMember,
  transferOwnership,
} from "@/features/auth/organization/actions";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { InitialTile } from "@/shared/components/ui/initial-tile";
import { List, ListRow } from "@/shared/components/ui/list";
import { toast } from "@/shared/components/ui/sonner";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import {
  ASSIGNABLE_ROLES,
  canLeaveWorkspace,
  canManageMember,
  canTransferOwnership,
  isAssignableRole,
} from "../permissions";
import { RoleBadge } from "./role-badge";

/** A member as the Team page reads it (`getOrganizationMembers`): display fields only. */
interface Member {
  /** The id of the membership: what the server changes and removes by. */
  id: string;
  /** The id of the person: not the same thing, and the server finds no membership by it. */
  userId: string;
  role: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
}

/**
 * What `removeMember` is asked: the membership, by its own id. The member that
 * is given carries the id of the person as well, which is never what is sent: a
 * membership is not found by it, and the person stayed in the workspace.
 */
export function removeMemberInput(
  orgId: string,
  member: Pick<Member, "id" | "userId">,
): { orgId: string; memberIdToRemove: string } {
  return { orgId, memberIdToRemove: member.id };
}

// Rows of the menu are 44 px high, where the shared row is 40: the menu is
// opened by a finger on a phone.
const itemStyles = "min-h-11";

// The photo of the person in a 32 px circle; until it loads, or when there is
// none, a tile of initials tinted from their id (a rename does not repaint it).
// It is a picture: the name next to it is who it is.
function MemberAvatar({ member, name }: { member: Member; name: string }) {
  const tile = (
    <InitialTile
      name={name}
      seed={member.userId}
      size="sm"
      className="rounded-full"
    />
  );

  if (!member.userImage) {
    return tile;
  }

  return (
    <Avatar>
      <AvatarImage src={member.userImage} alt="" />
      <AvatarFallback className="bg-transparent">{tile}</AvatarFallback>
    </Avatar>
  );
}

interface LeaveMenuProps {
  /** The workspace to leave: the page takes it from the session. */
  orgId: string;
  /** The name of the person, which the button of the menu says. */
  name: string;
}

// The « ⋯ » menu of the viewer's own row, with its one entry: leaving the
// workspace, which asks first, as the person loses it at once. Once the server
// has done it they go to the home, which opens their next workspace, or sends
// them to onboarding when they have none; if it has not, the dialog stays open
// with an error toast.
function LeaveMenu({ orgId, name }: LeaveMenuProps) {
  const t = useTranslations("organization");
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const left = useRef(false);

  const leave = async () => {
    const answer = await leaveWorkspace({ orgId });
    if (!answer.success) {
      throw new Error(answer.error);
    }

    left.current = true;
    toast.success(t("left"));
    // Leave at once: the page of a workspace the person no longer belongs to is
    // not one to stay on, and the shell is read again so that the switcher no
    // longer lists it.
    router.push("/dashboard");
    router.refresh();
  };

  // The confirmation has no Radix `Trigger` to give the focus back to: the
  // button of the menu does, unless the person left, and then the page goes.
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (!left.current) {
      trigger.current?.focus();
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={trigger}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("memberActions", { name })}
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          collisionPadding={8}
          className="w-56"
        >
          <DropdownMenuItem
            variant="destructive"
            className={itemStyles}
            onSelect={() => setLeaving(true)}
          >
            <LogOutIcon aria-hidden="true" />
            {t("leave")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        tone="danger"
        title={t("leaveTitle")}
        description={t("leaveDescription")}
        confirmLabel={t("leaveConfirm")}
        onCloseAutoFocus={restoreFocus}
        onConfirm={leave}
      />
    </>
  );
}

interface MemberRowProps {
  orgId: string;
  member: Member;
  /** The viewer is offered the menu of this member (`canManageMember`): the server asks for the role again. */
  manageable: boolean;
  /** This row is the viewer's own, and offers them to leave (`canLeaveWorkspace`): the server refuses the owner again. */
  leavable: boolean;
  /** The viewer owns the workspace and may hand it over to this member (`canTransferOwnership`): the server asks for the owner again. */
  transferable: boolean;
  /** Some row of the list has a menu: this one, which has none, keeps the room of one, so that the roles line up. */
  reserveMenu: boolean;
  /** Puts the focus on the list: where it goes when the row it was on is gone. */
  focusList: () => void;
}

// A member: the avatar, the name over the email, and at the end the role, with
// the « ⋯ » menu for those who may act. The menu changes the role (a choice
// between the two a member can have, the current one ticked) and removes the
// member, which asks first: a person who is removed loses the workspace at once.
// Both read the page again once the server has done it, so that the role and the
// list tell what the server holds. The button of the menu loads while an action
// runs, and keeps its place and its focus; a second action waits for the first
// (a flag that is read at once, not the state, which is only seen at the next
// render: two choices made before it would both be sent).
function MemberRow({
  orgId,
  member,
  manageable,
  leavable,
  transferable,
  reserveMenu,
  focusList,
}: MemberRowProps) {
  const t = useTranslations("organization");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [handingOver, setHandingOver] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const changing = useRef(false);
  const removed = useRef(false);
  const roleLabelId = useId();
  // A person with no name is told by their email, as a row of blank is no row.
  const name = member.userName.trim() || member.userEmail;

  const changeTo = async (role: string) => {
    if (changing.current || role === member.role || !isAssignableRole(role)) {
      return;
    }

    changing.current = true;
    setPending(true);
    try {
      const answer = await changeRole({
        orgId,
        memberId: member.id,
        newRole: role,
      });
      if (answer.success) {
        toast.success(t("roleChanged"));
        router.refresh();
      } else {
        toast.error(t("memberFailed"));
      }
    } catch (error) {
      unstable_rethrow(error);
      // Handled with the toast, not hidden: the error reporter of the app still hears it.
      toast.error(t("memberFailed"));
      reportHandledError(error);
    } finally {
      changing.current = false;
      setPending(false);
    }
  };

  // The confirmation rejects when the member is still there (the server refused,
  // or did not answer): the dialog then stays open with its error toast.
  const remove = async () => {
    const answer = await removeMember(removeMemberInput(orgId, member));
    if (!answer.success) {
      throw new Error(answer.error);
    }

    removed.current = true;
    toast.success(t("removed", { name }));
    router.refresh();
  };

  // Handing the workspace over asks first: the viewer becomes an admin at once, and only an owner can undo it.
  // Once it is done the page is read again, and the viewer's own row and menu tell what they now are.
  const handOver = async () => {
    const answer = await transferOwnership({ orgId, memberId: member.id });
    if (!answer.success) {
      throw new Error(answer.error);
    }

    toast.success(t("ownerChanged", { name }));
    router.refresh();
  };

  // The confirmation has no Radix `Trigger` to give the focus back to (Cancel and
  // Escape leave the person on this page): the button of the menu does, unless
  // the member is gone, and then so is the button: the list keeps the focus.
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (removed.current) {
      focusList();
    } else {
      trigger.current?.focus();
    }
  };

  return (
    <ListRow
      leading={<MemberAvatar member={member} name={name} />}
      title={name}
      meta={name === member.userEmail ? undefined : member.userEmail}
      trailing={
        <div className="flex items-center gap-3">
          <RoleBadge role={member.role} />
          {manageable ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    ref={trigger}
                    type="button"
                    variant="ghost"
                    size="icon"
                    loading={pending}
                    aria-label={t("memberActions", { name })}
                  >
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  collisionPadding={8}
                  className="w-56"
                >
                  <DropdownMenuLabel id={roleLabelId}>{t("role")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={member.role}
                    onValueChange={(role) => void changeTo(role)}
                    aria-labelledby={roleLabelId}
                  >
                    {ASSIGNABLE_ROLES.map((role) => (
                      <DropdownMenuRadioItem
                        key={role}
                        value={role}
                        className={itemStyles}
                      >
                        {t(role)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  {transferable ? (
                    <DropdownMenuItem className={itemStyles} onSelect={() => setHandingOver(true)}>
                      <CrownIcon aria-hidden="true" />
                      {t("makeOwner")}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    variant="destructive"
                    className={itemStyles}
                    onSelect={() => setRemoving(true)}
                  >
                    <UserMinusIcon aria-hidden="true" />
                    {t("remove")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ConfirmDialog
                open={removing}
                onOpenChange={setRemoving}
                tone="danger"
                title={t("removeTitle", { name })}
                description={t("removeDescription")}
                confirmLabel={t("removeConfirm")}
                onCloseAutoFocus={restoreFocus}
                onConfirm={remove}
              />
              {transferable ? (
                <ConfirmDialog
                  open={handingOver}
                  onOpenChange={setHandingOver}
                  title={t("makeOwnerTitle", { name })}
                  description={t("makeOwnerDescription", { name })}
                  confirmLabel={t("makeOwnerConfirm")}
                  onCloseAutoFocus={restoreFocus}
                  onConfirm={handOver}
                />
              ) : null}
            </>
          ) : leavable ? (
            <LeaveMenu orgId={orgId} name={name} />
          ) : reserveMenu ? (
            <span aria-hidden="true" className="size-10 shrink-0" />
          ) : null}
        </div>
      }
    />
  );
}

interface MembersListProps {
  /** The workspace the members belong to: the page takes it from the session. */
  orgId: string;
  members: Member[];
  /** Who is looking, from the session: their actions on a row depend on their role and on who the row is. */
  viewer: { userId: string; role: OrgRole };
  /** The id of the title of the card, which names the list: a screen reader says "Members, list, 3 items". */
  labelledBy: string;
}

// The people of the workspace, one row each, in the order they come. The rows
// are the page's to give: they are read on the server, with the workspace of the
// session, and arrive here as they are. What a row offers depends on the viewer
// (canManageMember, and canLeaveWorkspace on their own row): the server decides
// again. The rows that have no menu (the owner's, for instance) keep the room of
// one when others have it, so that the roles of the list line up on the right.
// The list is named by the title of its card.
export function MembersList({
  orgId,
  members,
  viewer,
  labelledBy,
}: MembersListProps) {
  const container = useRef<HTMLDivElement>(null);
  const rows = members.map((member) => ({
    member,
    manageable: canManageMember(viewer, member),
    leavable: canLeaveWorkspace(viewer, member),
    transferable: canTransferOwnership(viewer, member),
  }));
  const anyMenu = rows.some(({ manageable, leavable }) => manageable || leavable);

  return (
    <div ref={container} tabIndex={-1} className="focus:outline-hidden">
      <List aria-labelledby={labelledBy}>
        {rows.map(({ member, manageable, leavable, transferable }) => (
          <MemberRow
            key={member.id}
            orgId={orgId}
            member={member}
            manageable={manageable}
            leavable={leavable}
            transferable={transferable}
            reserveMenu={anyMenu}
            focusList={() => container.current?.focus()}
          />
        ))}
      </List>
    </div>
  );
}
