import type { Decorator, Preview } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { useLayoutEffect } from "react";
import en from "../src/locales/en.json";
import fr from "../src/locales/fr.json";
import { fontMono, fontSans } from "../src/styles/fonts";
import "../src/styles/global.css";

type Theme = "light" | "dark";

// The one list of languages: the toolbar, the messages and the decorator all
// read it. A project that adds a locale adds a line here.
const LOCALES = {
  en: { title: "English", messages: en },
  fr: { title: "Français", messages: fr },
};
type Locale = keyof typeof LOCALES;
const DEFAULT_LOCALE: Locale = "en";

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(LOCALES, value);
}

interface StoryFrameProps {
  theme: Theme;
  locale: Locale;
  children: ReactNode;
}

function StoryFrame({ theme, locale, children }: StoryFrameProps) {
  // As in the app layout, `dark` and the font variables go on <html>: the
  // typefaces and the default border color are resolved on :root.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add(fontSans.variable, fontMono.variable);
    root.classList.toggle("dark", theme === "dark");
    root.lang = locale;
  }, [theme, locale]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={LOCALES[locale].messages}
      timeZone="UTC"
    >
      <div className="bg-background text-foreground font-sans p-6">
        {children}
      </div>
    </NextIntlClientProvider>
  );
}

const withThemeAndLocale: Decorator = (Story, context) => {
  const { theme, locale } = context.globals;

  return (
    <StoryFrame
      theme={theme === "dark" ? "dark" : "light"}
      locale={isLocale(locale) ? locale : DEFAULT_LOCALE}
    >
      <Story />
    </StoryFrame>
  );
};

const preview: Preview = {
  decorators: [withThemeAndLocale],
  globalTypes: {
    theme: {
      description: "Color theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: "Language",
      toolbar: {
        title: "Language",
        icon: "globe",
        items: Object.entries(LOCALES).map(([value, { title }]) => ({
          value,
          title,
        })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
    locale: DEFAULT_LOCALE,
  },
  parameters: {
    // The Theme toolbar sets the color of the page: the Backgrounds tool would fight it.
    backgrounds: { disable: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: "todo" },
  },
};

export default preview;
