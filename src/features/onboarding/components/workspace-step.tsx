"use client";

import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { useId, useState } from "react";
import { authClient } from "@/features/auth/auth-client";
import { createOrganization } from "@/features/auth/organization/actions";
import { createWorkspace } from "@/features/auth/organization/create-workspace";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";

/** The length the server accepts for the name of a workspace, from 1 to this. */
const NAME_MAX = 100;

interface WorkspaceStepProps {
  onComplete: () => void;
  /** Absent on the step the wizard opens at: there is nothing before it to go back to. */
  onBack?: () => void;
}

/**
 * Tells the client that the workspace is the active one, and stays where it is.
 * Creating a workspace already makes it the active one of the session: the wizard
 * goes on to the next step (the shell's dialog goes on to the dashboard), and the
 * client only needs to hear of it. `false` when it could not.
 */
async function activate(organizationId: string): Promise<boolean> {
  try {
    const { error } = await authClient.organization.setActive({ organizationId });

    return !error;
  } catch (error) {
    unstable_rethrow(error);
    reportHandledError(error);

    return false;
  }
}

// The workspace of the person: the name is all it asks, as the dialog of the shell
// does, since the address of a workspace is made from it (`workspaceSlug`: two
// people can call theirs "Acme"). What is told under the field is in the words of the
// language of the page, never the sentence of the server: a name that is missing, or a
// workspace that could not be made (a slug that is taken is a refusal, like any other).
export function WorkspaceStep({ onComplete, onBack }: WorkspaceStepProps) {
  const t = useTranslations("workspace");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const fieldId = useId();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<"required" | "failed" | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    if (name.trim() === "") {
      setProblem("required");
      return;
    }

    setPending(true);
    setProblem(null);
    let created = false;
    try {
      created = await createWorkspace(
        { create: createOrganization, switchTo: activate, refresh: () => router.refresh() },
        name,
      );
    } catch (error) {
      unstable_rethrow(error);
      // Handled with the message below, not hidden: the error reporter of the
      // app still hears it.
      reportHandledError(error);
    } finally {
      setPending(false);
    }

    if (created) {
      onComplete();
    } else {
      setProblem("failed");
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field
        label={t("nameLabel")}
        htmlFor={fieldId}
        required
        error={problem === "required" ? t("nameRequired") : problem === "failed" ? t("createFailed") : undefined}
      >
        {/* read-only while it runs, not disabled: a disabled field drops the focus, which a failure should find where it was */}
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(null);
          }}
          maxLength={NAME_MAX}
          readOnly={pending}
          autoComplete="off"
          className="min-h-11"
        />
      </Field>
      <div className="flex gap-2">
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack} disabled={pending} className="flex-1">
            {tCommon("back")}
          </Button>
        ) : null}
        <Button
          type="submit"
          className="flex-1"
          loading={pending}
          loadingText={tCommon("loading")}
        >
          {tCommon("next")}
        </Button>
      </div>
    </form>
  );
}
