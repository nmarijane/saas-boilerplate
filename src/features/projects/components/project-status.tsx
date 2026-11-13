import type { ProjectStatus as Status } from "../schemas";
import type { StatusDotProps } from "@/shared/components/ui/status-dot";
import { useTranslations } from "next-intl";
import { StatusDot } from "@/shared/components/ui/status-dot";

// An active project has a green dot and a draft a neutral one, and each says
// its state in words: the dot only echoes them, so the color is never alone.
const tones = {
  active: "success",
  draft: "neutral",
} as const satisfies Record<Status, StatusDotProps["tone"]>;

export function ProjectStatus({ status }: { status: Status }) {
  const t = useTranslations("projects.status");

  return (
    <span className="text-meta text-ink-muted">
      <StatusDot tone={tones[status]} label={t(status)} />
    </span>
  );
}
