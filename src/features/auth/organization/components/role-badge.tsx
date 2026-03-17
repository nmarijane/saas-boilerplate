import { useTranslations } from "next-intl";
import { Badge } from "@/shared/components/ui/badge";

const roleVariants = {
  owner: "default",
  admin: "secondary",
  member: "outline",
} as const;

export function RoleBadge({ role }: { role: string }) {
  const t = useTranslations("organization");

  const variant = roleVariants[role as keyof typeof roleVariants] ?? "outline";
  const label = t(role as "owner" | "admin" | "member");

  return <Badge variant={variant}>{label}</Badge>;
}
