import type { ApiKeyStatus } from "../key-status";
import { useTranslations } from "next-intl";
import { Badge } from "@/shared/components/ui/badge";

// A key that can be used is told by the success tone. One that cannot is
// neutral, whether it was revoked or ran out: the word says which, and a key
// that is gone is the record of one, not an alarm.
const tones = {
  active: "success",
  expired: "neutral",
  revoked: "neutral",
} as const satisfies Record<ApiKeyStatus, "success" | "neutral">;

export function KeyStatusBadge({ status }: { status: ApiKeyStatus }) {
  const t = useTranslations("apiKeys.status");

  return <Badge variant={tones[status]}>{t(status)}</Badge>;
}
