import type { Metadata } from "next";
import { UserIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { appPageMetadata } from "@/features/app-shell";
import { requireWorkspace } from "@/features/auth/organization/workspace";
import { ActiveSessions } from "@/features/settings/components/active-sessions";
import { ChangePasswordForm } from "@/features/settings/components/change-password-form";
import { ConnectedAccounts } from "@/features/settings/components/connected-accounts";
import { DeleteAccountZone } from "@/features/settings/components/delete-account-zone";
import { ProfileForm } from "@/features/settings/components/profile-form";
import { PageHeader } from "@/shared/components/data/page-header";
import { SettingsNav } from "@/shared/components/shell/settings-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

interface Props {
  params: Promise<{ locale: string }>;
}

// The titles of the two cards that hold a list, which name their list: a screen
// reader says "Sessions, list, 3 items", not "list, 3 items". A constant is enough:
// each of these ids is on the page once.
const CONNECTED_ACCOUNTS_TITLE_ID = "connected-accounts-title";
const ACTIVE_SESSIONS_TITLE_ID = "active-sessions-title";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings.account" });

  return appPageMetadata(t("title"));
}

// The account of the person who is signed in, from the session: its header
// carries their email, and has no main action (every card has its own button).
// Four cards, each a section of the page with a level-two title: the profile,
// the password, the accounts they sign in with and the sessions they have open
// (the last two name their list by their title). The zone that deletes the
// account comes last, apart, with its own button.
export default async function AccountSettingsPage({ params }: Props) {
  const { locale } = await params;
  const { user } = await requireWorkspace();
  const [t, tSettings] = await Promise.all([
    getTranslations({ locale, namespace: "settings.account" }),
    getTranslations({ locale, namespace: "settings" }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserIcon}
        title={t("title")}
        context={user.email}
        tabs={<SettingsNav />}
      />
      <Card>
        <CardHeader>
          <CardTitle as="h2">{tSettings("profile")}</CardTitle>
          <CardDescription>{tSettings("profileDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaultValues={{
              name: user.name,
              email: user.email,
              image: user.image,
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2">{tSettings("password")}</CardTitle>
          <CardDescription>{tSettings("changePasswordDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2" id={CONNECTED_ACCOUNTS_TITLE_ID}>
            {tSettings("connectedAccounts")}
          </CardTitle>
          <CardDescription>{tSettings("connectedAccountsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectedAccounts labelledBy={CONNECTED_ACCOUNTS_TITLE_ID} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2" id={ACTIVE_SESSIONS_TITLE_ID}>
            {tSettings("activeSessions")}
          </CardTitle>
          <CardDescription>{tSettings("activeSessionsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ActiveSessions labelledBy={ACTIVE_SESSIONS_TITLE_ID} />
        </CardContent>
      </Card>
      <DeleteAccountZone />
    </div>
  );
}
