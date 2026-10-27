import { requirePlatformAdmin } from "@/features/platform/guards";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();
  return <div style={{ padding: "1.5rem" }}>{children}</div>;
}
