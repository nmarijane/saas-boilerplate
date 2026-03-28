import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/features/auth/guards";
import { WaitlistAdminTable } from "@/features/waitlist/components/waitlist-admin-table";
import { getAllWaitlistEntries, getTopReferrers, getWaitlistStats } from "@/features/waitlist/queries";
import { PageHeader } from "@/shared/components/data/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return generatePageMetadata(
    {
      title: t("waitlist"),
      description: t("title"),
      noIndex: true,
    },
    locale,
  );
}

export default async function AdminWaitlistPage({ searchParams }: Props) {
  await requireAdmin();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10));

  let stats = { total: 0, invited: 0 };
  let data: Awaited<ReturnType<typeof getAllWaitlistEntries>> = {
    entries: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  };
  let topReferrers: Awaited<ReturnType<typeof getTopReferrers>> = [];

  try {
    [stats, data, topReferrers] = await Promise.all([
      getWaitlistStats(),
      getAllWaitlistEntries(page),
      getTopReferrers(5),
    ]);
  } catch {
    // DB might not be ready
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Waitlist" />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Signups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Invited
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.invited}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Waiting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total - stats.invited}</div>
          </CardContent>
        </Card>
      </div>

      {topReferrers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Referrers</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {topReferrers.map((r, i) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    #{i + 1} {r.email}
                  </span>
                  <span className="font-medium">{r.referralCount} referrals</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            All Entries ({data.total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WaitlistAdminTable entries={data.entries} />
          {data.totalPages > 1 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Page {data.page} of {data.totalPages}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
