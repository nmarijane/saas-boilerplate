"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/features/auth/auth-client";
import { inviteMember } from "@/features/auth/organization/actions";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

interface InviteEntry {
  email: string;
  role: "admin" | "member";
}

interface InviteStepProps {
  onComplete: () => void;
  onBack: () => void;
  isCompleting: boolean;
}

export function InviteStep({ onComplete, onBack, isCompleting }: InviteStepProps) {
  const t = useTranslations("onboarding");
  const tOrg = useTranslations("organization");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const activeOrg = authClient.useActiveOrganization();
  const [invites, setInvites] = useState<InviteEntry[]>([
    { email: "", role: "member" },
  ]);
  const [isSending, setIsSending] = useState(false);

  const addInvite = () => {
    setInvites((prev) => [...prev, { email: "", role: "member" }]);
  };

  const removeInvite = (index: number) => {
    setInvites((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, email: string) => {
    setInvites((prev) =>
      prev.map((inv, i) => (i === index ? { ...inv, email } : inv)),
    );
  };

  const updateRole = (index: number, role: "admin" | "member") => {
    setInvites((prev) =>
      prev.map((inv, i) => (i === index ? { ...inv, role } : inv)),
    );
  };

  const handleSendAndComplete = async () => {
    const orgId = activeOrg?.data?.id;
    if (!orgId) {
      onComplete();
      return;
    }

    const validInvites = invites.filter((inv) => inv.email.includes("@"));

    if (validInvites.length > 0) {
      setIsSending(true);
      try {
        await Promise.all(
          validInvites.map((inv) =>
            inviteMember({ orgId, email: inv.email, role: inv.role }),
          ),
        );
        toast.success(tCommon("success"));
      } catch {
        toast.error(tCommon("error"));
      } finally {
        setIsSending(false);
      }
    }

    onComplete();
  };

  return (
    <div className="space-y-4">
      {invites.map((invite, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            type="email"
            placeholder={tAuth("email")}
            value={invite.email}
            onChange={(e) => updateEmail(index, e.target.value)}
            className="flex-1"
          />
          <Select
            value={invite.role}
            onValueChange={(val) => updateRole(index, val as "admin" | "member")}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">{tOrg("admin")}</SelectItem>
              <SelectItem value="member">{tOrg("member")}</SelectItem>
            </SelectContent>
          </Select>
          {invites.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeInvite(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
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

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          {tCommon("back")}
        </Button>
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
