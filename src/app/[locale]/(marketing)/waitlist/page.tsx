import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { WaitlistPageClient } from "@/features/waitlist/components/waitlist-page-client";
import { getWaitlistEntry, getWaitlistStats } from "@/features/waitlist/queries";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
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
  const { email: queryEmail } = await searchParams;

  const cookieStore = await cookies();
  const cookieEmail = cookieStore.get("waitlist_email")?.value;
  const emailToCheck = queryEmail ?? cookieEmail;

  let stats = { total: 0, invited: 0 };
  let entryWithPosition: Awaited<ReturnType<typeof getWaitlistEntry>> = null;

  try {
    stats = await getWaitlistStats();
    if (emailToCheck) {
      entryWithPosition = await getWaitlistEntry(emailToCheck);
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
