"use client";

import type { ComponentProps, FormEvent } from "react";
import type { InviteOutcome } from "../invite-member";
import type { AssignableRole } from "../permissions";
import type { LimitInfo } from "@/shared/lib/action-refusal";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { inviteMember } from "@/features/auth/organization/actions";
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
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { PageAlert } from "@/shared/components/ui/page-alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { toast } from "@/shared/components/ui/sonner";
import { inviteMemberFlow } from "../invite-member";
import { ASSIGNABLE_ROLES, isAssignableRole } from "../permissions";

/** The roles are the options of a Select, whose trigger is the one element that takes the id and the aria attributes of its field. */
function RoleSelect({
  value,
  onValueChange,
  disabled,
  ...props
}: ComponentProps<typeof SelectTrigger> & {
  value: AssignableRole;
  onValueChange: (role: AssignableRole) => void;
}) {
  const t = useTranslations("organization");

  return (
    <Select
      value={value}
      onValueChange={(role) => {
        if (isAssignableRole(role)) {
          onValueChange(role);
        }
      }}
      disabled={disabled}
    >
      <SelectTrigger className="w-full" {...props}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ASSIGNABLE_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {t(role)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface InviteFormViewProps {
  email: string;
  role: AssignableRole;
  /** The invitation is being sent: the fields wait, and so does the button. */
  pending: boolean;
  /** The email is not one: said under the field, as the person sent nothing. */
  invalid: boolean;
  /** The server refused, or did not answer: what was typed is kept, and the dialog says so. */
  failed: boolean;
  /** The plan has no seat left: the lock is shown instead of the failure. */
  limit?: LimitInfo | null;
  onEmailChange: (email: string) => void;
  onRoleChange: (role: AssignableRole) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

// What is in the dialog, as a function of the state it is given (as the form of a
// project is): a refusal of the server cannot be produced in a story, so the view
// is what a story and a test draw. It needs the context of a dialog for its
// header and its Cancel button. The email is read-only while it sends, not
// disabled: a disabled field drops the focus, which a failure should find where
// it was. The form checks the address itself (`noValidate` leaves the browser's
// bubble out, which speaks the language of the browser, not of the page). Send
// waits for an address and shows that it works by loading, and keeps the focus.
// The error is an alert, announced when it appears, above the button just pressed.
export function InviteFormView({
  email,
  role,
  pending,
  invalid,
  failed,
  limit,
  onEmailChange,
  onRoleChange,
  onSubmit,
}: InviteFormViewProps) {
  const t = useTranslations("organization");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const emailId = useId();
  const roleId = useId();

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("invite")}</DialogTitle>
        <DialogDescription>{t("inviteDescription")}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Field
          label={tAuth("email")}
          htmlFor={emailId}
          required
          error={invalid ? t("inviteInvalidEmail") : undefined}
        >
          <Input
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            readOnly={pending}
            autoComplete="off"
            className="min-h-11"
          />
        </Field>
        <Field label={t("role")} htmlFor={roleId}>
          <RoleSelect
            value={role}
            onValueChange={onRoleChange}
            disabled={pending}
          />
        </Field>
        {limit ? <LimitNotice limit={limit} feature={t("inviteLimitFeature")} /> : null}
        {failed && !limit ? <PageAlert tone="danger">{t("inviteFailed")}</PageAlert> : null}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            {tCommon("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" loading={pending} disabled={email.trim() === ""}>
          {t("inviteSend")}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface InviteFormProps {
  orgId: string;
  pending: boolean;
  onPendingChange: (pending: boolean) => void;
  /** The invitation is sent: the dialog has nothing left to do. */
  onClose: () => void;
}

// What was typed lives here, with the content, which Radix unmounts when the
// dialog closes: a dialog that opens again starts with an empty field, however
// it was closed. Whether the invitation is going lives outside, with the dialog,
// which cannot be dismissed while it is.
function InviteForm({
  orgId,
  pending,
  onPendingChange,
  onClose,
}: InviteFormProps) {
  const t = useTranslations("organization");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("member");
  const [invalid, setInvalid] = useState(false);
  const [failed, setFailed] = useState(false);
  const [limit, setLimit] = useState<LimitInfo | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || email.trim() === "") {
      return;
    }

    onPendingChange(true);
    setFailed(false);
    setLimit(null);
    let outcome: InviteOutcome = "failed";
    try {
      outcome = await inviteMemberFlow(
        {
          invite: inviteMember,
          onLimit: setLimit,
          notify: (address) => toast.success(t("invited", { email: address })),
        },
        { orgId, email, role, locale },
      );
    } finally {
      onPendingChange(false);
    }

    if (outcome === "invited") {
      onClose();
    } else {
      setInvalid(outcome === "invalid");
      setFailed(outcome === "failed" || outcome === "limit");
    }
  };

  return (
    <InviteFormView
      email={email}
      role={role}
      pending={pending}
      invalid={invalid}
      failed={failed}
      limit={limit}
      onEmailChange={(next) => {
        setEmail(next);
        setInvalid(false);
        setFailed(false);
      }}
      onRoleChange={(next) => {
        setRole(next);
        setFailed(false);
      }}
      onSubmit={submit}
    />
  );
}

interface InviteModalProps {
  /** The workspace to invite to: the page takes it from the session. */
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the dialog has closed, to say where the focus goes. Radix gives
   * it back to the `Trigger` of a dialog, and this one has none (what opens it
   * is a button of the page, a long way from it in the markup): left to Radix the
   * focus is dropped on the page body (WCAG 2.4.3). The handler gets the event
   * Radix waits on, and calls `preventDefault` on it, then focuses the opener.
   */
  onCloseAutoFocus?: (event: Event) => void;
}

// The dialog that invites someone to the workspace: an email, and the role they
// will have. Once the invitation is sent it closes and says so. A failure stays
// in the dialog, where the person can fix the address or try again.
export function InviteModal({
  orgId,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: InviteModalProps) {
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={whileConfirming(pending, onOpenChange)}>
      <DialogContent size="sm" onCloseAutoFocus={onCloseAutoFocus}>
        <InviteForm
          orgId={orgId}
          pending={pending}
          onPendingChange={setPending}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
