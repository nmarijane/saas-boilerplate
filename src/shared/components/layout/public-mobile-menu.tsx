"use client";

import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/components/ui/sheet";
import { Link } from "@/shared/lib/i18n-navigation";

interface PublicMobileMenuProps {
  links: { href: string; label: string }[];
  signInLabel: string;
  /** The button that starts the free trial or the sign-up: where it leads and what it says. */
  cta: { href: string; label: string };
}

// The menu of the public pages on a phone: the navigation does not fit beside
// the buttons under 768 px, so it opens in a drawer. The links close it, since
// they lead to another page of the same layout, which does not unmount it.
export function PublicMobileMenu({ links, signInLabel, cta }: PublicMobileMenuProps) {
  const t = useTranslations("shell");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="md:hidden">
          <MenuIcon aria-hidden="true" />
          <span className="sr-only">{t("menu")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="gap-6">
        <SheetHeader>
          <SheetTitle>{t("menu")}</SheetTitle>
          <SheetDescription className="sr-only">{t("menu")}</SheetDescription>
        </SheetHeader>
        <nav aria-label={t("menu")} className="flex flex-col gap-1 px-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="tap-target flex min-h-11 items-center rounded-md px-3 text-section text-ink hover:bg-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 px-4 pb-4">
          <Button asChild variant="outline">
            <Link href="/sign-in" onClick={() => setOpen(false)}>
              {signInLabel}
            </Link>
          </Button>
          <Button asChild>
            <Link href={cta.href} prefetch={false} onClick={() => setOpen(false)}>
              {cta.label}
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
