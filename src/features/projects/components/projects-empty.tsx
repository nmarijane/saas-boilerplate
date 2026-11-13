"use client";

import { FolderIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { EmptyState } from "@/shared/components/data/empty-state";
import { CreateProjectDialog } from "./create-project-dialog";

// The list of a workspace that has no project yet: one sentence, and the one
// button that opens the dialog. The title is a second-level heading, under the
// h1 of the page.
export function ProjectsEmpty({ orgId }: { orgId: string }) {
  const t = useTranslations("projects");
  const [open, setOpen] = useState(false);
  const zone = useRef<HTMLDivElement>(null);

  // The button is the empty state's, which hands out no ref to it: it is the
  // one button in the zone (the dialog is drawn elsewhere, in a portal). The
  // dialog has no Radix `Trigger` to give the focus back to, so this does.
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    zone.current?.querySelector("button")?.focus();
  };

  return (
    <div ref={zone}>
      <EmptyState
        icon={FolderIcon}
        headingLevel={2}
        title={t("empty.title")}
        description={t("empty.description")}
        action={{ label: t("new"), onClick: () => setOpen(true) }}
      />
      <CreateProjectDialog
        orgId={orgId}
        open={open}
        onOpenChange={setOpen}
        onCloseAutoFocus={restoreFocus}
      />
    </div>
  );
}
