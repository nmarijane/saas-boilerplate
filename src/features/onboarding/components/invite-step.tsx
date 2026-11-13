"use client";

import { Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { authClient } from "@/features/auth/auth-client";
import { inviteMember } from "@/features/auth/organization/actions";
import { Button } from "@/shared/components/ui/button";
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
import { sendInvites } from "../send-invites";

interface InviteEntry {
  email: string;
  role: "admin" | "member";
}

interface InviteStepProps {
  onComplete: () => void;
  /** Absent on the step the wizard opens at: there is nothing before it to go back to. */
  onBack?: () => void;
  isCompleting: boolean;
}

interface InviteRowProps {
  /** The place of the row in the list, from 1: what names its fields, which have a placeholder and no label to see. */
  number: number;
  invite: InviteEntry;
  /** There is more than one row, so this one can go. */
  removable: boolean;
  onEmail: (email: string) => void;
  onRole: (role: InviteEntry["role"]) => void;
  onRemove: () => void;
}

// One person to invite: an e-mail address, the role they get, and a button that takes
// the row away when there are several. The fields have a placeholder and no room for a
// label beside them, so each is named by the person it is for (a placeholder is not a
// name, and the rows would read alike): the address, the role, and the button whose icon
// says nothing.
export function InviteRow({ number, invite, removable, onEmail, onRole, onRemove }: InviteRowProps) {
  const t = useTranslations("onboarding.invite");
  const tOrg = useTranslations("organization");
  const tAuth = useTranslations("auth");

  return (
    <div className="flex items-center gap-2">
      <Input
        type="email"
        placeholder={tAuth("email")}
        aria-label={t("emailLabel", { number })}
        value={invite.email}
        onChange={(e) => onEmail(e.target.value)}
        className="flex-1"
      />
      <Select
        value={invite.role}
        onValueChange={(role) => onRole(role as InviteEntry["role"])}
      >
        <SelectTrigger className="w-28" aria-label={t("roleLabel", { number })}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">{tOrg("admin")}</SelectItem>
          <SelectItem value="member">{tOrg("member")}</SelectItem>
        </SelectContent>
      </Select>
      {removable && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("remove", { number })}
          onClick={onRemove}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// What the step tells above its buttons when some rows are still there after a try: an alert,
// announced when it appears, and nothing at rest.
export function InviteProblem({ problem }: { problem: "failed" | "invalid" | null }) {
  const t = useTranslations("onboarding.invite");

  return problem ? <PageAlert tone="danger">{t(problem)}</PageAlert> : null;
}

export function InviteStep({ onComplete, onBack, isCompleting }: InviteStepProps) {
  const t = useTranslations("onboarding");
  const tOrg = useTranslations("organization");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const activeOrg = authClient.useActiveOrganization();
  const [invites, setInvites] = useState<InviteEntry[]>([
    { email: "", role: "member" },
  ]);
  const [isSending, setIsSending] = useState(false);
  // Why some rows are still there after a try: what the person is told above the buttons
  const [problem, setProblem] = useState<"failed" | "invalid" | null>(null);

  const addInvite = () => {
    setInvites((prev) => [...prev, { email: "", role: "member" }]);
  };

  const removeInvite = (index: number) => {
    setInvites((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, email: string) => {
    setProblem(null);
    setInvites((prev) =>
      prev.map((inv, i) => (i === index ? { ...inv, email } : inv)),
    );
  };

  const updateRole = (index: number, role: "admin" | "member") => {
    setInvites((prev) =>
      prev.map((inv, i) => (i === index ? { ...inv, role } : inv)),
    );
  };

  // Sends the rows that are filled. When they all go, the step is done. When one does not (the server
  // refused, or the address is none), the rows that went are gone from the list, the others stay as they
  // were typed, the step says so above the buttons and is not left: nothing is told as a success that was not
  const handleSendAndComplete = async () => {
    const orgId = activeOrg?.data?.id;
    if (!orgId) {
      onComplete();
      return;
    }

    setIsSending(true);
    setProblem(null);
    let result: Awaited<ReturnType<typeof sendInvites>>;
    try {
      result = await sendInvites({ invite: inviteMember }, { orgId, locale, rows: invites });
    } finally {
      setIsSending(false);
    }

    if (result.kept.length > 0) {
      setInvites(result.kept);
      setProblem(result.problem);
      return;
    }
    if (result.sent > 0) {
      toast.success(tCommon("success"));
    }
    onComplete();
  };

  return (
    <div className="space-y-4">
      {invites.map((invite, index) => (
        <InviteRow
          // The rows have no identity of their own: the list is edited by position
          key={index}
          number={index + 1}
          invite={invite}
          removable={invites.length > 1}
          onEmail={(email) => updateEmail(index, email)}
          onRole={(role) => updateRole(index, role)}
          onRemove={() => removeInvite(index)}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addInvite}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        {tOrg("invite")}
      </Button>

      <InviteProblem problem={problem} />

      <div className="flex gap-2 pt-2">
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            {tCommon("back")}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          onClick={onComplete}
          disabled={isSending || isCompleting}
          className="flex-1"
        >
          {t("skipInvite")}
        </Button>
        <Button
          type="button"
          onClick={handleSendAndComplete}
          disabled={isSending || isCompleting}
          className="flex-1"
        >
          {isSending || isCompleting ? tCommon("loading") : t("complete")}
        </Button>
      </div>
    </div>
  );
}
