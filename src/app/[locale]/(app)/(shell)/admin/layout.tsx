import type { ReactNode } from "react";
import { requireAdmin } from "@/features/auth/guards";

// The admin pages are for platform admins, and the sidebar shows their links to
// no one else. This guard keeps anyone else from rendering anything under /admin,
// but it does not stand in for the one of each page: a layout is not run again
// on every navigation inside it, so every page calls `requireAdmin()` itself.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();

  return children;
}
