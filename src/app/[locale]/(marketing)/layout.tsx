import { useTranslations } from "next-intl";

import { Footer } from "@/shared/components/layout/footer";
import { ThemeToggle } from "@/shared/components/layout/theme-toggle";
import { Button } from "@/shared/components/ui/button";
import { Link } from "@/shared/lib/i18n-navigation";

function MarketingHeader() {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-bold tracking-tight">
            SaaS
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <Link
              href="/#features"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("marketing.features.title")}
            </Link>
            <Link
              href="/pricing"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("marketing.pricing.title")}
            </Link>
            <Link
              href="/about"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("marketing.about.title")}
            </Link>
            <Link
              href="/changelog"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("marketing.changelog.title")}
            </Link>
            <Link
              href="/blog"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("marketing.blog.navTitle")}
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sign-in">{t("auth.signIn")}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/sign-up">{t("auth.signUp")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
