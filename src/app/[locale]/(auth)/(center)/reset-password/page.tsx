import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { firstOf } from "@/features/auth/search-params";
import { TextLink } from "@/shared/components/ui/text-link";
import { Link } from "@/shared/lib/i18n-navigation";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Where the link of the reset email lands. Better Auth checks the token of the
// link, and redirects here with `?token=` when it holds, or with
// `?error=INVALID_TOKEN` when it does not (missing, unknown, expired or already
// used). A good link gets the form, which draws its own card, as the card says
// what the form is doing (choosing the password, then done); a dead one, or an
// address that was typed by hand, gets a card of this page that says so and leads
// to a new request, with no form to fill in for nothing.
export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth" });
  const token = firstOf(query.token);

  if (!token || query.error) {
    return (
      <AuthCard title={t("linkExpiredTitle")} description={t("linkExpired")}>
        <p className="text-center">
          <TextLink asChild className="tap-target">
            <Link href="/forgot-password">{t("requestNewLink")}</Link>
          </TextLink>
        </p>
      </AuthCard>
    );
  }

  return <ResetPasswordForm token={token} />;
}
