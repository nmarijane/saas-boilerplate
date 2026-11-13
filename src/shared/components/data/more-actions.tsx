import type { LucideIcon } from "lucide-react";
import { EllipsisIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

interface PageHeaderAction {
  label: string;
  /** Called with nothing: the event of the menu is not its business. */
  onSelect: () => void;
  /** Drawn before the label. */
  icon?: LucideIcon;
  /** For an action that deletes or cannot be undone: it goes last, after a separator, in the danger color. */
  destructive?: boolean;
}

// The « ⋯ » menu of a header: the actions that are not the one button of the
// page. The headers of a page (PageHeader) and of an entity (EntityHeader)
// share it. A destructive action goes last, after a separator, wherever it was
// given: it never sits against the others, where a slip of the finger would
// reach it.
function MoreActions({ actions }: { actions: PageHeaderAction[] }) {
  const t = useTranslations("common");
  const regular = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t("moreActions")}>
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={8} className="w-56">
        {regular.map((action) => (
          <ActionRow key={action.label} {...action} />
        ))}
        {regular.length > 0 && destructive.length > 0 ? (
          <DropdownMenuSeparator />
        ) : null}
        {destructive.map((action) => (
          <ActionRow key={action.label} {...action} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActionRow({
  label,
  onSelect,
  icon: Icon,
  destructive,
}: PageHeaderAction) {
  return (
    <DropdownMenuItem
      variant={destructive ? "destructive" : "default"}
      onSelect={() => onSelect()}
    >
      {Icon ? <Icon /> : null}
      {label}
    </DropdownMenuItem>
  );
}

export { MoreActions };
export type { PageHeaderAction };
