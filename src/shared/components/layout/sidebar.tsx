"use client";

import {
  LayoutDashboardIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";

import { Separator } from "@/shared/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { usePathname } from "@/shared/lib/i18n-navigation";
import { cn } from "@/shared/utils/cn";

const LOCALE_PREFIX_RE = /^\/(en|fr)/;

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const defaultNavItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboardIcon className="size-4" />,
  },
  {
    label: "Settings",
    href: "/settings/profile",
    icon: <SettingsIcon className="size-4" />,
  },
];

interface SidebarProps {
  orgSwitcher?: React.ReactNode;
  userMenu?: React.ReactNode;
  navItems?: NavItem[];
}

export function Sidebar({
  orgSwitcher,
  userMenu,
  navItems = defaultNavItems,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    const cleanPath = pathname.replace(LOCALE_PREFIX_RE, "");
    return cleanPath.startsWith(href);
  };

  const navContent = (
    <nav className="flex flex-1 flex-col gap-1 px-2">
      {navItems.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive(item.href)
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {item.icon}
          {!collapsed && <span>{item.label}</span>}
        </a>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <MenuIcon className="size-5" />
        <span className="sr-only">Open menu</span>
      </Button>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="p-4">
            <SheetTitle className="text-lg font-bold">Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col">
            {orgSwitcher && (
              <>
                <div className="px-4 py-2">{orgSwitcher}</div>
                <Separator />
              </>
            )}
            <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </a>
              ))}
            </nav>
            {userMenu && (
              <>
                <Separator />
                <div className="p-4">{userMenu}</div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex h-screen flex-col border-r bg-background transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo / brand */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight">SaaS</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(collapsed && "mx-auto")}
          >
            {collapsed ? (
              <PanelLeftOpenIcon className="size-4" />
            ) : (
              <PanelLeftCloseIcon className="size-4" />
            )}
            <span className="sr-only">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </span>
          </Button>
        </div>

        {/* Org switcher */}
        {orgSwitcher && !collapsed && (
          <>
            <div className="px-4 py-3">{orgSwitcher}</div>
            <Separator />
          </>
        )}

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-2">{navContent}</div>

        {/* User menu */}
        {userMenu && (
          <>
            <Separator />
            <div className="p-4">{userMenu}</div>
          </>
        )}
      </aside>
    </>
  );
}
