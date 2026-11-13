import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { headers } from "next/headers";
import { Toaster } from "@/shared/components/ui/sonner";
import { APP_NAME } from "@/shared/config/app";
import { routing } from "@/shared/lib/i18n-routing";
import { cn } from "@/shared/utils/cn";
import { fontMono, fontSans } from "@/styles/fonts";
import "@/styles/global.css";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: "Production-ready SaaS boilerplate built with Next.js",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();
  // The nonce of the request (src/proxy.ts): the script that sets the theme before the first paint is
  // written by next-themes, not by Next, and must carry it. Reading it also makes every page of the app
  // rendered per request, which a policy with a nonce needs (src/shared/lib/csp.ts).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      className={cn(fontSans.variable, fontMono.variable)}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <NextIntlClientProvider messages={messages}>
            {children}
            <Toaster position="bottom-right" />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
