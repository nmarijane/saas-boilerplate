import {
  BarChartIcon,
  BookOpenIcon,
  BuildingIcon,
  ClipboardListIcon,
  FlagIcon,
  UsersIcon,
} from "lucide-react";

import { requireAdmin } from "@/features/auth/guards";
import { Header } from "@/shared/components/layout/header";
import { Sidebar } from "@/shared/components/layout/sidebar";

const adminNavItems = [
  {
    label: "Users",
    href: "/admin/users",
    icon: <UsersIcon className="size-4" />,
  },
  {
    label: "Organizations",
    href: "/admin/organizations",
    icon: <BuildingIcon className="size-4" />,
  },
  {
    label: "Metrics",
    href: "/admin/metrics",
    icon: <BarChartIcon className="size-4" />,
  },
  {
    label: "Audit Log",
    href: "/admin/audit",
    icon: <ClipboardListIcon className="size-4" />,
  },
  {
    label: "Feature Flags",
    href: "/admin/features",
    icon: <FlagIcon className="size-4" />,
  },
  {
    label: "Changelog",
    href: "/admin/changelog",
    icon: <BookOpenIcon className="size-4" />,
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex h-screen">
      <Sidebar navItems={adminNavItems} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
