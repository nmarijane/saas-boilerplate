import { useTranslations } from "next-intl";
import { Link } from "@/shared/lib/i18n-navigation";

export function Footer() {
  const tMarketing = useTranslations("marketing");
  const tLegal = useTranslations("legal");

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto flex flex-col items-center gap-6 px-4 py-8 md:flex-row md:justify-between">
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link
            href="/about"
            className="hover:text-foreground transition-colors"
          >
            {tMarketing("about.title")}
          </Link>
          <Link
            href="/pricing"
            className="hover:text-foreground transition-colors"
          >
            {tMarketing("pricing.title")}
          </Link>
          <Link
            href="/changelog"
            className="hover:text-foreground transition-colors"
          >
            {tMarketing("changelog.title")}
          </Link>
          <Link
            href="/legal/terms"
            className="hover:text-foreground transition-colors"
          >
            {tLegal("terms")}
          </Link>
          <Link
            href="/legal/privacy"
            className="hover:text-foreground transition-colors"
          >
            {tLegal("privacy")}
          </Link>
          <Link
            href="/legal/mentions"
            className="hover:text-foreground transition-colors"
          >
            {tLegal("mentions")}
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} SaaS Boilerplate
        </p>
      </div>
    </footer>
  );
}
