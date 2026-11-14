"use client";

import type { FormEvent } from "react";
import type { LimitInfo } from "@/shared/lib/action-refusal";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LimitNotice } from "@/shared/components/data/limit-notice";
import { Button } from "@/shared/components/ui/button";
import { whileConfirming } from "@/shared/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { toast } from "@/shared/components/ui/sonner";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { createProject } from "../actions";
import { createProjectFlow } from "../project-flows";
import { ProjectFields } from "./project-fields";

interface CreateProjectFormViewProps {
  name: string;
  description: string;
  /** The creation is running: the fields wait, and so does the button. */
  pending: boolean;
  /** The server refused, or did not answer: what was typed is kept, and the dialog says so. */
  failed: boolean;
  /** The plan has no room for another project: the lock is shown instead of the failure. */
  limit?: LimitInfo | null;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

// What is in the dialog, as a function of the state it is given (as the
// feedback form is): a refusal of the server cannot be produced in a story, so
// the view is what a story and a test draw. It needs the context of a dialog
// for its header and its Cancel button. The fields are the ones of every form of
// a project (ProjectFields), read-only while it sends. Create waits for a name
// and shows that it is working, and keeps the focus. The error is an alert,
// announced when it appears, and it sits above the button that was just pressed.
export function CreateProjectFormView({
  name,
  description,
  pending,
  failed,
  limit,
  onNameChange,
  onDescriptionChange,
  onSubmit,
}: CreateProjectFormViewProps) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("create.title")}</DialogTitle>
        <DialogDescription>{t("create.description")}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <ProjectFields
          name={name}
          description={description}
          pending={pending}
          onNameChange={onNameChange}
          onDescriptionChange={onDescriptionChange}
        />
        {limit ? <LimitNotice limit={limit} feature={t("create.limitFeature")} /> : null}
        {failed && !limit ? (
          <PageAlert tone="danger">{t("create.failed")}</PageAlert>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            {tCommon("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" loading={pending} disabled={name.trim() === ""}>
          {tCommon("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface CreateProjectFormProps {
  orgId: string;
  pending: boolean;
  onPendingChange: (pending: boolean) => void;
  /** The project exists: the dialog has nothing left to do. */
  onClose: () => void;
}

// What was typed lives here, with the content, which Radix unmounts when the
// dialog closes: a dialog that opens again starts with empty fields, however it
// was closed. Whether the creation is running lives outside, with the dialog,
// which cannot be dismissed while it is.
function CreateProjectForm({
  orgId,
  pending,
  onPendingChange,
  onClose,
}: CreateProjectFormProps) {
  const t = useTranslations("projects");
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [failed, setFailed] = useState(false);
  const [limit, setLimit] = useState<LimitInfo | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || name.trim() === "") {
      return;
    }

    onPendingChange(true);
    setFailed(false);
    setLimit(null);
    let created = false;
    try {
      created = await createProjectFlow(
        {
          onLimit: setLimit,
          create: createProject,
          close: onClose,
          notify: () => toast.success(t("created")),
          open: (id) => router.push(`/projects/${id}`),
        },
        { orgId, name, description },
      );
    } finally {
      onPendingChange(false);
    }
    setFailed(!created);
  };

  return (
    <CreateProjectFormView
      name={name}
      description={description}
      pending={pending}
      failed={failed}
      limit={limit}
      onNameChange={(next) => {
        setName(next);
        setFailed(false);
      }}
      onDescriptionChange={(next) => {
        setDescription(next);
        setFailed(false);
      }}
      onSubmit={submit}
    />
  );
}

interface CreateProjectDialogProps {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the dialog has closed, to say where the focus goes. Radix gives
   * it back to the `Trigger` of a dialog, and this one has none (what opens it
   * is a button of the page, or of the home, a long way from it in the markup):
   * left to Radix the focus is dropped on the page body (WCAG 2.4.3). The
   * handler gets the event Radix waits on, and calls `preventDefault` on it.
   */
  onCloseAutoFocus?: (event: Event) => void;
}

// The dialog that creates a project: a name, and a description if there is
// one to give. Once the project exists it closes, says so, and opens the
// project. A failure stays in the dialog, where the person can try again.
export function CreateProjectDialog({
  orgId,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: CreateProjectDialogProps) {
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={whileConfirming(pending, onOpenChange)}>
      <DialogContent size="sm" onCloseAutoFocus={onCloseAutoFocus}>
        <CreateProjectForm
          orgId={orgId}
          pending={pending}
          onPendingChange={setPending}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
