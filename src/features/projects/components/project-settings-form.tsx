"use client";

import type { FormEvent } from "react";
import type { ProjectStatus } from "../schemas";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { InlineStatus } from "@/shared/components/ui/inline-status";
import { Label } from "@/shared/components/ui/label";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { editing } from "@/shared/utils/helpers";
import { updateProject } from "../actions";
import { updateProjectFlow } from "../project-flows";
import { PROJECT_STATUSES } from "../schemas";
import { ProjectFields } from "./project-fields";

interface ProjectSettingsFormViewProps {
  name: string;
  description: string;
  status: ProjectStatus;
  /** A save is running: the fields and the status wait, and so does the button. */
  pending: boolean;
  /** The last save worked: a status says so next to the button. */
  saved: boolean;
  /** The last save did not work: what was typed is kept, and an alert says so. */
  failed: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onStatusChange: (status: ProjectStatus) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

// The fields of the project, as a function of the state it is given (as the
// feedback form is), so that a story and a test can draw a save that worked or
// that did not. The name and the description are the ones of every form of a
// project (ProjectFields), read-only while it saves. Save shows that it works by
// loading, and is disabled only while the name is empty. The status is a short
// exclusive choice, with a caption for those who see it: the legend of the
// group is for those who hear it, and the caption is hidden from them so that it
// is not said twice. The error is an alert and the success a status, announced
// when they show up; the indicator of a save running is the button's, never
// doubled.
export function ProjectSettingsFormView({
  name,
  description,
  status,
  pending,
  saved,
  failed,
  onNameChange,
  onDescriptionChange,
  onStatusChange,
  onSubmit,
}: ProjectSettingsFormViewProps) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <ProjectFields
        name={name}
        description={description}
        pending={pending}
        onNameChange={onNameChange}
        onDescriptionChange={onDescriptionChange}
      />
      <div className="grid gap-1.5">
        <Label asChild className="block leading-5">
          <span aria-hidden="true">{t("fields.status")}</span>
        </Label>
        <SegmentedControl
          label={t("fields.status")}
          options={PROJECT_STATUSES.map((value) => ({
            value,
            label: t(`status.${value}`),
          }))}
          value={status}
          onValueChange={onStatusChange}
          disabled={pending}
          className="w-fit"
        />
      </div>
      {failed ? <PageAlert tone="danger">{t("settings.failed")}</PageAlert> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button type="submit" loading={pending} disabled={name.trim() === ""}>
          {tCommon("save")}
        </Button>
        {saved ? (
          <InlineStatus state="success">{t("settings.saved")}</InlineStatus>
        ) : null}
      </div>
    </form>
  );
}

interface ProjectSettingsFormProps {
  orgId: string;
  project: {
    id: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
  };
}

// The form of the settings of a project, with what it holds now. Saving reads
// the page again, so that the header of the project (its name, its description,
// its status) and the form tell the same thing.
export function ProjectSettingsForm({
  orgId,
  project,
}: ProjectSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState(project.status);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  const forget = () => {
    setSaved(false);
    setFailed(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || name.trim() === "") {
      return;
    }

    setPending(true);
    forget();
    let ok = false;
    try {
      ok = await updateProjectFlow(
        { update: updateProject, refresh: () => router.refresh() },
        { orgId, projectId: project.id, name, description, status },
      );
    } finally {
      setPending(false);
    }
    setSaved(ok);
    setFailed(!ok);
  };

  return (
    <ProjectSettingsFormView
      name={name}
      description={description}
      status={status}
      pending={pending}
      saved={saved}
      failed={failed}
      onNameChange={editing(setName, forget)}
      onDescriptionChange={editing(setDescription, forget)}
      onStatusChange={editing(setStatus, forget)}
      onSubmit={submit}
    />
  );
}
