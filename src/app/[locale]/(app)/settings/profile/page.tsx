import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireAuth } from "@/features/auth/guards";
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
            Update your personal information.
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
            Update your password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Password management is handled via Better Auth. Use the forgot
            password flow to reset your password.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
