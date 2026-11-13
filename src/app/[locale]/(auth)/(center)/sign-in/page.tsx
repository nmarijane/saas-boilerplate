import { getTranslations } from "next-intl/server";
import { oauthErrorKey } from "@/features/auth/auth-errors";
import { AuthCard } from "@/features/auth/components/auth-card";
import { SignInForm } from "@/features/auth/components/sign-in-form";
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

// Two things come in the address. `callbackUrl` is the page the person asked for
// when the proxy sent them here: the form follows it once they are in, if it is a
// page of the app, and the link to the sign-up page keeps it (an invitation sends
// a person who has no account yet to either). `error` is what Better Auth brings them back with when a
// provider was cancelled or refused: the form tells it, in the words of the
// language of the page (the code is looked up, never shown).
export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth" });
  const callbackUrl = firstOf(query.callbackUrl);

  return (
    <AuthCard
      title={t("signIn")}
      description={t("signInDescription")}
      footer={
        <>
          {t("noAccount")}{" "}
          <TextLink asChild className="tap-target">
            <Link href={withCallbackUrl("/sign-up", callbackUrl)}>{t("signUp")}</Link>
          </TextLink>
        </>
      }
    >
      <SignInForm
        socialProviders={enabledSocialProviders()}
        callbackUrl={callbackUrl}
        initialFailure={oauthErrorKey(query.error)}
      />
    </AuthCard>
  );
}
