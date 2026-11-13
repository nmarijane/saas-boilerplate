import { useTranslations } from "next-intl";
import { Badge } from "@/shared/components/ui/badge";

// The role is a word in a quiet badge: the owner and the admin are neutral, and
// a member, who has nothing to add to it, is an outline. No tone is borrowed
// from the brand or from a status: on a page about people, a rank is not what
// should catch the eye.
const roleVariants = {
  owner: "neutral",
  admin: "neutral",
  member: "outline",
} as const;

function isRole(role: string): role is keyof typeof roleVariants {
  return Object.hasOwn(roleVariants, role);
}

// A role this list does not know (one a project adds) is told as it is written,
// in an outline, rather than by a message that does not exist.
export function RoleBadge({ role }: { role: string }) {
  const t = useTranslations("organization");

  if (!isRole(role)) {
    return <Badge variant="outline">{role}</Badge>;
  }

  return <Badge variant={roleVariants[role]}>{t(role)}</Badge>;
}
