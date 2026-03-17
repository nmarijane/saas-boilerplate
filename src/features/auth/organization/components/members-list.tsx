"use client";

import { MoreHorizontal, UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  changeRole,
  removeMember,
} from "@/features/auth/organization/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { RoleBadge } from "./role-badge";

interface Member {
  id: string;
  userId: string;
  role: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
}

interface MembersListProps {
  members: Member[];
  orgId: string;
  currentUserId: string;
  currentUserRole: string;
  onMemberUpdated?: () => void;
}

export function MembersList({
  members,
  orgId,
  currentUserId,
  currentUserRole,
  onMemberUpdated,
}: MembersListProps) {
  const t = useTranslations("organization");
  const tCommon = useTranslations("common");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  const handleRemove = async (memberId: string) => {
    setLoadingId(memberId);
    try {
      await removeMember({ orgId, memberIdToRemove: memberId });
      toast.success(tCommon("success"));
      onMemberUpdated?.();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setLoadingId(null);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: "admin" | "member") => {
    setLoadingId(memberId);
    try {
      await changeRole({ orgId, memberId, newRole });
      toast.success(tCommon("success"));
      onMemberUpdated?.();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const initials = member.userName
          ?.split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2) ?? "?";

        const isOwner = member.role === "owner";
        const isSelf = member.userId === currentUserId;
        const canModify = canManage && !isOwner && !isSelf;

        return (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.userImage ?? undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{member.userName}</p>
                <p className="text-xs text-muted-foreground">
                  {member.userEmail}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canModify ? (
                <Select
                  defaultValue={member.role}
                  onValueChange={(val) =>
                    handleRoleChange(member.id, val as "admin" | "member")
                  }
                  disabled={loadingId === member.id}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t("admin")}</SelectItem>
                    <SelectItem value="member">{t("member")}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <RoleBadge role={member.role} />
              )}

              {canModify && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={loadingId === member.id}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleRemove(member.userId)}
                      className="text-destructive"
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      {tCommon("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
