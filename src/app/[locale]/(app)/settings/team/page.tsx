"use client";

import { useTranslations } from "next-intl";
import { useSession } from "@/features/auth/hooks/use-session";
import { InviteModal } from "@/features/auth/organization/components/invite-modal";
import { MembersList } from "@/features/auth/organization/components/members-list";
import { useMembers } from "@/features/auth/organization/hooks/use-members";
import { useOrganization } from "@/features/auth/organization/hooks/use-organization";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

export default function TeamSettingsPage() {
  const t = useTranslations("settings");
  const tOrg = useTranslations("organization");
  const { data: session } = useSession();
  const activeOrg = useOrganization();
  const orgId = activeOrg?.data?.id;
  const { members, refetch } = useMembers(orgId);

  const currentMember = members.find(
    (m) => m.userId === session?.user?.id,
  );
  const currentUserRole = currentMember?.role ?? "member";

  if (!orgId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">{tOrg("switchOrg")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("team")}</CardTitle>
            <CardDescription>{tOrg("members")}</CardDescription>
          </div>
          {(currentUserRole === "owner" || currentUserRole === "admin") && (
            <InviteModal orgId={orgId} onInvited={refetch} />
          )}
        </CardHeader>
        <CardContent>
          <MembersList
            members={members}
            orgId={orgId}
            currentUserId={session?.user?.id ?? ""}
            currentUserRole={currentUserRole}
            onMemberUpdated={refetch}
          />
        </CardContent>
      </Card>
    </div>
  );
}
