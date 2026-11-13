import type { Metadata } from "next";
import { UsersIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { appPageMetadata } from "@/features/app-shell";
import { DeleteWorkspaceZone } from "@/features/auth/organization/components/delete-workspace-zone";
import { InviteButton } from "@/features/auth/organization/components/invite-button";
import { MembersList } from "@/features/auth/organization/components/members-list";
import {
  canDeleteWorkspace,
  canManageMembers,
} from "@/features/auth/organization/permissions";
import { getOrganizationMembers } from "@/features/auth/organization/queries";
import { requireWorkspace } from "@/features/auth/organization/workspace";
import { PageHeader } from "@/shared/components/data/page-header";
import { SettingsNav } from "@/shared/components/shell/settings-nav";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

interface Props {
  params: Promise<{ locale: string }>;
}

// The title of the card of the members, which names the list: a screen reader
// says "Members, list, 3 items", not "list, 3 items". A constant is enough: the id
// is on the page once.
const MEMBERS_TITLE_ID = "members-title";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings.team" });

  return appPageMetadata(t("title"));
}

// The people of the workspace, read on the server for the workspace of the
// session: the page takes it from `requireWorkspace()`, never from the URL, so
// that no one reads the members of another. What the role of the viewer cannot
// do is not drawn: the invitation button, which is the header's one main action,
// is for the owner and the admins, the actions of a row are theirs too (never on
// the owner or on themselves), the person's own row offers to leave to anyone
// but the owner, and the zone that deletes the workspace is the owner's alone.
// The server asks for the same roles again.
export default async function TeamSettingsPage({ params }: Props) {
  const { locale } = await params;
  const { user, workspace } = await requireWorkspace();
  const [t, tOrg, members] = await Promise.all([
    getTranslations({ locale, namespace: "settings.team" }),
    getTranslations({ locale, namespace: "organization" }),
    getOrganizationMembers(workspace.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UsersIcon}
        title={t("title")}
        context={t("count", { count: members.length })}
        primaryAction={
          canManageMembers(workspace.role) ? (
            <InviteButton orgId={workspace.id} />
          ) : undefined
        }
        tabs={<SettingsNav />}
      />
      <Card>
        <CardHeader>
          <CardTitle as="h2" id={MEMBERS_TITLE_ID}>
            {tOrg("members")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MembersList
            orgId={workspace.id}
            members={members}
            viewer={{ userId: user.id, role: workspace.role }}
            labelledBy={MEMBERS_TITLE_ID}
          />
        </CardContent>
      </Card>
      {canDeleteWorkspace(workspace.role) ? (
        <DeleteWorkspaceZone orgId={workspace.id} name={workspace.name} />
      ) : null}
    </div>
  );
}
