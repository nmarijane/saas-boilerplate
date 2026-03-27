"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

interface ReferralLinkProps {
  referralCode: string;
}

export function ReferralLink({ referralCode }: ReferralLinkProps) {
  const t = useTranslations("waitlist");
  const [copied, setCopied] = useState(false);

  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/waitlist/${referralCode}`
      : `/waitlist/${referralCode}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(setCopied, 2000, false);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("referralLink")}</p>
      <div className="flex gap-2">
        <Input value={referralUrl} readOnly className="flex-1 font-mono text-sm" />
        <Button variant="outline" size="icon" onClick={handleCopy}>
          {copied ? (
            <Check className="size-4 text-green-600" />
          ) : (
            <Copy className="size-4" />
          )}
          <span className="sr-only">{copied ? t("copied") : t("copy")}</span>
        </Button>
      </div>
    </div>
  );
}
