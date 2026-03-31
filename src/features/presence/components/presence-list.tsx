"use client";

import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { getInitials } from "@/shared/utils/helpers";
import { PresenceIndicator } from "./presence-indicator";
import { usePresenceContext } from "./presence-provider";

export function PresenceList() {
  const { members } = usePresenceContext();
  const t = useTranslations("presence");

  const onlineMembers = members.filter((m) => m.status !== "offline");

  if (onlineMembers.length === 0) {
    return (
      <p className="text-muted-foreground px-3 py-2 text-xs">
        {t("noOneOnline")}
      </p>
    );
  }

  return (
    <div className="space-y-1 px-2">
      <p className="text-muted-foreground px-1 text-xs font-medium">
        {t("online", { count: onlineMembers.length })}
      </p>
      {onlineMembers.map((member) => (
        <div
          key={member.userId}
          className="flex items-center gap-2 rounded-md px-2 py-1.5"
        >
          <div className="relative">
            <Avatar className="size-6">
              <AvatarImage src={member.userImage ?? undefined} />
              <AvatarFallback className="text-[10px]">
                {getInitials(member.userName)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -right-0.5 -bottom-0.5">
              <PresenceIndicator status={member.status} size="sm" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{member.userName}</p>
            <p className="text-muted-foreground truncate text-xs">
              {member.currentPage}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
