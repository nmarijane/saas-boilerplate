import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { getServerSession } from "@/features/auth/guards";
import { InvitationAnswer } from "@/features/auth/organization/components/invitation-answer";
import { SwitchAccountButton } from "@/features/auth/organization/components/switch-account-button";
import { invitationPath } from "@/features/auth/organization/invitation-path";
import { invitationView } from "@/features/auth/organization/invitation-view";
import { getInvitation } from "@/features/auth/organization/queries";
import { withCallbackUrl } from "@/features/auth/post-sign-in";
import { Button } from "@/shared/components/ui/button";
import { TextLink } from "@/shared/components/ui/text-link";
import { Link } from "@/shared/lib/i18n-navigation";

interface Props {
  params: Promise<{ locale: string; invitationId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "invitation" });

  // The address holds the id of an invitation: nothing here is for a search engine
  return { title: t("title"), robots: { index: false, follow: false } };
}

// Where the link of an invitation e-mail lands, in the language of the person
// who sent it. The page needs no session: a visitor is told what it is, and
// signs in or signs up, then comes back here (`callbackUrl`). The person signed
// in with the invited address sees the workspace and who invited them, and
// answers; someone signed in with another address is told which one was
// invited, and may switch accounts. A link that expired, was cancelled or was
// already answered is a dead link, as the reset page's is. The answer goes
// through the server actions, which ask Better Auth again.
export default async function AcceptInvitationPage({ params }: Props) {
  const { locale, invitationId } = await params;
  const [t, invitation, session] = await Promise.all([
    getTranslations({ locale, namespace: "invitation" }),
    getInvitation(invitationId),
    getServerSession(),
  ]);
  const view = invitationView(invitation, session && { email: session.user.email }, new Date());
  // Signing in, or signing up then in, comes back here
  const back = invitationPath(invitationId, locale);

  switch (view.kind) {
    case "dead":
      return (
        <AuthCard title={t("deadTitle")} description={t("deadDescription")}>
          <p className="text-center">
            <TextLink asChild className="tap-target">
              <Link href="/dashboard">{t("openApp")}</Link>
            </TextLink>
          </p>
        </AuthCard>
      );
    case "signedOut":
      return (
        <AuthCard title={t("signedOutTitle")} description={t("signedOutDescription")}>
          <div className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link href={withCallbackUrl("/sign-in", back)}>{t("signIn")}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={withCallbackUrl("/sign-up", back)}>{t("signUp")}</Link>
            </Button>
          </div>
        </AuthCard>
      );
    case "otherAccount":
      return (
        <AuthCard
          title={t("otherAccountTitle")}
          description={t("otherAccountDescription", { invited: view.invitedEmail, current: view.currentEmail })}
        >
          <SwitchAccountButton href={withCallbackUrl("/sign-in", back)} />
        </AuthCard>
      );
    case "invited":
      return (
        <InvitationAnswer
          invitationId={view.invitationId}
          workspaceName={view.workspaceName}
          inviterName={view.inviterName}
          role={view.role}
        />
      );
  }
}
