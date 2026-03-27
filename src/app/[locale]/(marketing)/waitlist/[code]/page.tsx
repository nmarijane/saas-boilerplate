import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { WaitlistForm } from "@/features/waitlist/components/waitlist-form";
import { getWaitlistEntryByCode, getWaitlistStats } from "@/features/waitlist/queries";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string; code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "waitlist" });

  return generatePageMetadata(
    {
      title: t("referralPageTitle"),
      description: t("referralPageDescription"),
    },
    locale,
  );
}

export default async function WaitlistReferralPage({ params }: Props) {
  const { code } = await params;
  const t = await getTranslations("waitlist");

  let referrer: Awaited<ReturnType<typeof getWaitlistEntryByCode>> | null = null;
  let stats = { total: 0, invited: 0 };

  try {
    referrer = await getWaitlistEntryByCode(code);
    stats = await getWaitlistStats();
  } catch {
    // DB might not be ready
  }

  if (!referrer) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <div className="space-y-8 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
            👋
          </div>
          <h1 className="text-4xl font-bold tracking-tight">{t("referralHeroTitle")}</h1>
          <p className="text-lg text-muted-foreground">
            {t("referralHeroSubtitle", { count: stats.total })}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-8 text-left shadow-sm">
          <div className="mb-6 rounded-lg bg-muted p-4 text-center">
            <p className="text-sm font-medium">
              {t("joinAheadOf", { count: Math.max(0, stats.total - 1) })}
            </p>
          </div>
          <WaitlistForm referralCode={code} />
        </div>
      </div>
    </div>
  );
}
