import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";

const messages = { en, fr };

/**
 * Renders a node to static HTML inside the next-intl provider the app layout
 * mounts, so components that call `useTranslations` work in the node
 * environment. The time zone is fixed so formatting dates never reaches
 * next-intl's environment fallback.
 */
export function renderWithIntl(
  node: ReactNode,
  locale: "en" | "fr" = "en",
): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale]}
      timeZone="UTC"
    >
      {node}
    </NextIntlClientProvider>,
  );
}
