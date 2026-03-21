import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireAuth } from "@/features/auth/guards";
import { ActiveSessions } from "@/features/settings/components/active-sessions";
import { ChangePasswordForm } from "@/features/settings/components/change-password-form";
import { ConnectedAccounts } from "@/features/settings/components/connected-accounts";
import { ProfileForm } from "@/features/settings/components/profile-form";
import { PageHeader } from "@/shared/components/data/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });

  return generatePageMetadata(
    {
      title: t("profile"),
      description: t("title"),
      noIndex: true,
    },
    locale,
  );
}

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });
  const session = await requireAuth();

  return (
    <div className="space-y-6">
      <PageHeader title={t("profile")} description={t("title")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("updateProfile")}</CardTitle>
          <CardDescription>
            {t("title")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaultValues={{
              name: session.user.name,
              email: session.user.email,
              image: session.user.image ?? null,
            }}
          />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>{t("changePassword")}</CardTitle>
          <CardDescription>
            {t("changePasswordDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>{t("connectedAccounts")}</CardTitle>
          <CardDescription>
            {t("connectedAccountsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectedAccounts />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>{t("activeSessions")}</CardTitle>
          <CardDescription>
            {t("activeSessionsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActiveSessions />
        </CardContent>
      </Card>
    </div>
  );
}
