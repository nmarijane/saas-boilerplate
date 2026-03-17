import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/shared/components/data/page-header";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
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
    locale
  );
}

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

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
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="john@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar">{t("avatar")}</Label>
              <Input id="avatar" type="file" accept="image/*" />
            </div>
            <Button type="submit">{tCommon("save")}</Button>
          </form>
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
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t("currentPassword")}</Label>
              <Input id="current-password" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("newPassword")}</Label>
              <Input id="new-password" type="password" />
            </div>
            <Button type="submit">{tCommon("save")}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
