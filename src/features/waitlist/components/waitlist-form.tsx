"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { joinWaitlist } from "../actions";

interface WaitlistFormProps {
  referralCode?: string;
  onSuccess?: (email: string, code: string) => void;
}

export function WaitlistForm({ referralCode, onSuccess }: WaitlistFormProps) {
  const t = useTranslations("waitlist");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await joinWaitlist({ email, referralCode });
      if (result.success) {
        onSuccess?.(email, result.data.referralCode);
      } else {
        setError(result.error);
      }
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="waitlist-email">{t("emailLabel")}</Label>
        <div className="flex gap-2">
          <Input
            id="waitlist-email"
            type="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("joining")}
              </>
            ) : (
              t("joinButton")
            )}
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
