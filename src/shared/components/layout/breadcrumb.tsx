"use client";

import { ChevronRightIcon, HomeIcon } from "lucide-react";
import { Fragment } from "react";
import { usePathname } from "@/shared/lib/i18n-navigation";

import { cn } from "@/shared/utils/cn";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname
    .split("/")
    .filter((s) => s && !s.startsWith("(") && s !== "en" && s !== "fr");

  return segments.map((segment, index) => {
    const href = `/${  segments.slice(0, index + 1).join("/")}`;
    const label = segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { label, href };
  });
}

export function Breadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const items = generateBreadcrumbs(pathname);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-sm", className)}
    >
      <a
        href="/"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <HomeIcon className="size-4" />
      </a>
      {items.map((item, index) => (
        <Fragment key={item.href}>
          <ChevronRightIcon className="size-3.5 text-muted-foreground" />
          {index === items.length - 1 ? (
            <span className="font-medium text-foreground">{item.label}</span>
          ) : (
            <a
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </a>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
