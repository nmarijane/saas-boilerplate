"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { PROJECT_DESCRIPTION_MAX, PROJECT_NAME_MAX } from "../schemas";

interface ProjectFieldsProps {
  name: string;
  description: string;
  /** A creation or a save is running: the fields wait, read-only. */
  pending: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
}

// The two fields of every form of a project: the name, which is required, and
// the description, which says how long it may be. Both stop at what the server
// accepts. The fields are read-only while the form sends, not disabled: a
// disabled field drops the focus, which a failure should find where it was. The
// name is a 44 px target. It returns the two fields with no box of their own, so
// the form that holds them sets the space between them; each instance makes its
// own ids, so two forms on a page never share a label.
export function ProjectFields({
  name,
  description,
  pending,
  onNameChange,
  onDescriptionChange,
}: ProjectFieldsProps) {
  const t = useTranslations("projects");
  const nameId = useId();
  const descriptionId = useId();

  return (
    <>
      <Field label={t("fields.name")} htmlFor={nameId} required>
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          maxLength={PROJECT_NAME_MAX}
          readOnly={pending}
          autoComplete="off"
          className="min-h-11"
        />
      </Field>
      <Field
        label={t("fields.description")}
        htmlFor={descriptionId}
        hint={t("fields.descriptionHint", { max: PROJECT_DESCRIPTION_MAX })}
      >
        <Textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          maxLength={PROJECT_DESCRIPTION_MAX}
          readOnly={pending}
          rows={3}
        />
      </Field>
    </>
  );
}
