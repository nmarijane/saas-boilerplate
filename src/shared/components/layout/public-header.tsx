import { useTranslations } from "next-intl";
import { ShellLogo } from "@/shared/components/shell/logo";
import { Button } from "@/shared/components/ui/button";
import { APP_NAME } from "@/shared/config/app";
import { Link } from "@/shared/lib/i18n-navigation";
import { PublicMobileMenu } from "./public-mobile-menu";
import { ThemeToggle } from "./theme-toggle";

interface PublicHeaderProps {
  /**
   * Where "Free trial" leads: the sign-up with the recommended plan kept. Null
   * when the product has no trial, and the button then says "Sign up".
   */
  trialHref: string | null;
}

// The header of the public pages: the logo, the navigation, then "Sign in" and
// the one button that starts (the free trial of the recommended plan, or the
// sign-up). Under 768 px the navigation and both buttons move into a menu.
export function PublicHeader({ trialHref }: PublicHeaderProps) {
  const t = useTranslations();
  const links = [
    { href: "/#features", label: t("marketing.navLabels.features") },
    { href: "/pricing", label: t("pricing.title") },
    { href: "/about", label: t("marketing.navLabels.about") },
    { href: "/changelog", label: t("marketing.navLabels.changelog") },
    { href: "/blog", label: t("marketing.blog.navTitle") },
  ];
  const cta = trialHref ? { href: trialHref, label: t("marketing.freeTrial") } : { href: "/sign-up", label: t("auth.signUp") };

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-8">
          <ShellLogo productName={APP_NAME} href="/" />
          <nav aria-label={t("marketing.navigation")} className="hidden items-center gap-1 text-body md:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="tap-target rounded-md px-3 py-2 text-ink-muted transition-colors hover:text-ink">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link href="/sign-in">{t("auth.signIn")}</Link>
          </Button>
          <Button asChild className="hidden md:inline-flex">
            {/* Not prefetched: the proxy remembers a plan named in the address when the page is asked for (the sign-up of a trial) */}
            <Link href={cta.href} prefetch={false}>
              {cta.label}
            </Link>
          </Button>
          <PublicMobileMenu links={links} signInLabel={t("auth.signIn")} cta={cta} />
        </div>
      </div>
    </header>
  );
}
