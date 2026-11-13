import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { withCallbackUrl } from "@/features/auth/post-sign-in";
import { firstOf } from "@/features/auth/search-params";
import { enabledSocialProviders } from "@/features/auth/social-providers";
import { TextLink } from "@/shared/components/ui/text-link";
import { Link } from "@/shared/lib/i18n-navigation";

// The providers that are on come from the environment (`auth.ts` reads their keys),
// and the page asks them when it is drawn: it is drawn for each request, so that a
// build never freezes the list that was on the day it ran.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// `callbackUrl` is the page that sent the person here (an invitation): the
// verification link and the sign-in page lead back to it once they are in, if
// it is a page of the app, and the link to the sign-in page keeps it.
export default async function SignUpPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth" });
  const callbackUrl = firstOf(query.callbackUrl);

  return (
    <AuthCard
      title={t("signUp")}
      description={t("signUpDescription")}
      footer={
        <>
          {t("hasAccount")}{" "}
          <TextLink asChild className="tap-target">
            <Link href={withCallbackUrl("/sign-in", callbackUrl)}>{t("signIn")}</Link>
          </TextLink>
        </>
      }
    >
      <SignUpForm socialProviders={enabledSocialProviders()} callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
