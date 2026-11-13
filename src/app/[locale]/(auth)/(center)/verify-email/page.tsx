import { CircleCheckIcon, MailIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { withCallbackUrl } from "@/features/auth/post-sign-in";
import { firstOf } from "@/features/auth/search-params";
import { Button } from "@/shared/components/ui/button";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { TextLink } from "@/shared/components/ui/text-link";
import { Link } from "@/shared/lib/i18n-navigation";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Where the link of the verification e-mail lands (`verificationLink`). Better
// Auth checks the token of the link and redirects here with `?verified=1` when it
// holds (the sign-up form and the sign-in that was refused both ask for it), or with
// `?error=` when it does not (expired, or already used): a good link is told that
// the address is verified, with the way to sign in; a dead one is told so, with the
// way to get a new link, which is to sign in (an address that is not verified is
// sent one when it signs in). An address that was typed by hand, with neither, gets
// the card that says an e-mail is on its way. The sign-in button keeps the page the
// person signed up from (`callbackUrl`, an invitation), so that signing in leads back to it.
export default async function VerifyEmailPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth" });
  const signIn = (
    <Button asChild className="w-full">
      <Link href={withCallbackUrl("/sign-in", firstOf(query.callbackUrl))}>{t("signIn")}</Link>
    </Button>
  );

  if (query.error) {
    return (
      <AuthCard title={t("linkExpiredTitle")} description={t("verifyLinkExpired")}>
        {signIn}
      </AuthCard>
    );
  }

  if (firstOf(query.verified) === "1") {
    return (
      <AuthCard
        title={t("verifiedTitle")}
        description={t("verifiedDescription")}
        icon={<IconTile icon={CircleCheckIcon} tone="success" size="lg" />}
      >
        {signIn}
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("verifyEmail")}
      description={t("verifyEmailDescription")}
      icon={<IconTile icon={MailIcon} tone="brand" size="lg" />}
      footer={
        <TextLink asChild className="tap-target">
          <Link href="/sign-in">{t("backToSignIn")}</Link>
        </TextLink>
      }
    />
  );
}
