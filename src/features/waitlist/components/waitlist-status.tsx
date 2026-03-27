"use client";

import { Share2, Twitter } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ReferralLink } from "./referral-link";

interface WaitlistStatusProps {
  position: number;
  referralCode: string;
  referralCount: number;
  totalEntries: number;
}

export function WaitlistStatus({
  position,
  referralCode,
  referralCount,
  totalEntries,
}: WaitlistStatusProps) {
  const t = useTranslations("waitlist");

  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/waitlist/${referralCode}`
      : `/waitlist/${referralCode}`;

  const tweetText = encodeURIComponent(
    `I'm #${position} on the waitlist! Join me: ${referralUrl}`,
  );
  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("statusTitle")}</CardTitle>
        <CardDescription>
          {t("statusDescription", { total: totalEntries })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="text-6xl font-bold text-primary">#{position}</div>
          <p className="mt-1 text-sm text-muted-foreground">{t("yourPosition")}</p>
        </div>

        {referralCount > 0 && (
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-sm font-medium">
              {t("referralStats", { count: referralCount })}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("sharePrompt")}</p>
          <ReferralLink referralCode={referralCode} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => window.open(twitterUrl, "_blank")}
            >
              <Twitter className="mr-2 size-4" />
              {t("shareTwitter")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={async () => {
                if (navigator.share) {
                  await navigator.share({ url: referralUrl });
                }
              }}
            >
              <Share2 className="mr-2 size-4" />
              {t("share")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
