import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WaitlistPageClient } from "@/features/waitlist/components/waitlist-page-client";
import { getWaitlistEntryWithPosition, getWaitlistStats } from "@/features/waitlist/queries";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "waitlist" });

  return generatePageMetadata(
    {
      title: t("pageTitle"),
      description: t("pageDescription"),
    },
    locale,
  );
}

export default async function WaitlistPage({ searchParams }: Props) {
  const t = await getTranslations("waitlist");
  // The page shows a position for a referral code, which joining answers with: never for an address, which is
  // anybody's to type (an address in the query shows nothing)
  const { code } = await searchParams;

  let stats = { total: 0, invited: 0 };
  let entryWithPosition: Awaited<ReturnType<typeof getWaitlistEntryWithPosition>> = null;

  try {
    stats = await getWaitlistStats();
    if (typeof code === "string" && code.length > 0 && code.length <= 32) {
      entryWithPosition = await getWaitlistEntryWithPosition(code);
    }
  } catch {
    // DB might not be ready
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <div className="space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">{t("heroTitle")}</h1>
          <p className="text-lg text-muted-foreground">{t("heroSubtitle")}</p>
          {stats.total > 0 && (
            <p className="text-sm font-medium text-primary">
              {t("totalJoined", { count: stats.total })}
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-8 text-left shadow-sm">
          <WaitlistPageClient
            initialPosition={entryWithPosition?.position}
            initialReferralCode={entryWithPosition?.referralCode}
            initialReferralCount={entryWithPosition?.referralCount}
            totalEntries={stats.total}
          />
        </div>
      </div>
    </div>
  );
}
