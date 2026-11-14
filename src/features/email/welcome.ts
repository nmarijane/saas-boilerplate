import type { ReactElement } from "react";
import { createTranslator, hasLocale } from "next-intl";
import { getLocale } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import enMessages from "@/locales/en.json";
import frMessages from "@/locales/fr.json";
import { DEV_APP_URL } from "@/shared/config/app";
import { routing } from "@/shared/lib/i18n-routing";
import { WelcomeEmail } from "./templates";
import "server-only";

const MESSAGES = { en: enMessages, fr: frMessages } as const;

/** The language of the request that is being answered; the default one outside a request (a script, a test). */
async function requestLanguage(): Promise<(typeof routing.locales)[number]> {
  try {
    const locale = await getLocale();

    return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  } catch (error) {
    unstable_rethrow(error);
    return routing.defaultLocale;
  }
}

/** The welcome mail of an account whose address is confirmed, in the language the person signed up in. */
export async function buildWelcomeMail(name: string): Promise<{ subject: string; template: ReactElement }> {
  const language = await requestLanguage();
  const t = createTranslator({ locale: language, messages: MESSAGES[language], namespace: "emails.welcome" });
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? DEV_APP_URL).replace(/\/$/, "");

  return {
    subject: t("subject"),
    template: WelcomeEmail({
      name,
      greeting: t("greeting", { name }),
      dashboardUrl: `${base}/${language}/dashboard`,
      previewText: t("subject"),
      heading: t("heading"),
      bodyText: t("body"),
      buttonText: t("button"),
    }),
  };
}
