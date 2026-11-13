import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { RESET_TOKEN_COOKIE } from "@/features/auth/reset-token";
import { TextLink } from "@/shared/components/ui/text-link";
import { Link } from "@/shared/lib/i18n-navigation";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Where the link of the reset email lands. Better Auth checks the token of the
// link, and redirects here with `?token=` when it holds, or with
// `?error=INVALID_TOKEN` when it does not (missing, unknown, expired or already
// used). The proxy takes the token out of the address before this page is drawn:
// it waits in an HttpOnly cookie (reset-token.ts), and this page only learns that
// one is there, never what it is, so that it is not in the payload of the page or
// in the history of the router. A good link gets the form, which draws its own
// card, as the card says what the form is doing (choosing the password, then
// done); a dead one, or an address that was typed by hand, gets a card of this
// page that says so and leads to a new request, with no form to fill in for nothing.
export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth" });
  const waiting = (await cookies()).has(RESET_TOKEN_COOKIE);

  if (!waiting || query.error) {
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

  return <ResetPasswordForm />;
}
