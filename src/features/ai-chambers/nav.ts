import type { NavGroup } from "@ai-chambers/design-system";

export function buildWorkspaceNav(options: {
  isPlatformAdmin: boolean;
}): NavGroup[] {
  const nav: NavGroup[] = [
    { label: "Workspace", items: [{ label: "Overview", href: "/dashboard" }] },
    {
      label: "AI Tools",
      items: [{ label: "All tools", href: "/tools" }],
    },
    {
      label: "Operations",
      items: [
        { label: "Runs & Results", href: "/runs" },
        { label: "Billing", href: "/settings/billing" },
        { label: "Settings", href: "/settings/profile" },
      ],
    },
  ];

  if (options.isPlatformAdmin) {
    nav.push({
      label: "Platform",
      items: [{ label: "Admin", href: "/platform" }],
    });
  }

  return nav;
}
