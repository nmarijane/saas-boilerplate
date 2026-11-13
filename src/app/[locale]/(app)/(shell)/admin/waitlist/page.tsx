import type { Metadata } from "next";
import { HourglassIcon, ListOrderedIcon, SendIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { appPageMetadata } from "@/features/app-shell";
import { requireAdmin } from "@/features/auth/guards";
import { WaitlistAdminTable } from "@/features/waitlist/components/waitlist-admin-table";
import { getAllWaitlistEntries, getTopReferrers, getWaitlistStats } from "@/features/waitlist/queries";
import { PageHeader } from "@/shared/components/data/page-header";
import { Pagination } from "@/shared/components/data/pagination";
import { StatCard } from "@/shared/components/data/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { List, ListRow } from "@/shared/components/ui/list";
import { pageFrom } from "@/shared/utils/pagination";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

// The title of the card of the referrers, which names the list: a screen reader
// says "Top referrers, list, 5 items", not "list, 5 items". A constant is enough:
// the id is on the page once.
const REFERRERS_TITLE_ID = "referrers-title";

// The title of the card of the entries, which names the box its table scrolls in.
const ENTRIES_TITLE_ID = "entries-title";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return appPageMetadata(t("waitlist"), { context: t("title") });
}

/** The address of a page of the list: the first has no page in it. */
function hrefOf(page: number) {
  return page === 1 ? "/admin/waitlist" : `/admin/waitlist?page=${page}`;
}

// The waiting list, for the admins of the platform. The header gives the total
// of the signups, and the cards the figures that are not the total: it is told
// once, so there is no card for it and no count in the title of the entries.
export default async function AdminWaitlistPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { locale } = await params;
  const { page } = await searchParams;
  const requested = pageFrom(page);
  const [t, format, stats, read, topReferrers] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getFormatter({ locale }),
    getWaitlistStats(),
    getAllWaitlistEntries(requested),
    getTopReferrers(5),
  ]);
  // A page past the last is the last, not an empty page that says "Page 99 of 2": the list is read again from it.
  const data =
    read.totalPages > 0 && requested > read.totalPages
      ? await getAllWaitlistEntries(read.totalPages)
      : read;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ListOrderedIcon}
        title={t("waitlist")}
        context={t("waitlistCount", { count: stats.total })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title={t("waitlistInvited")}
          value={format.number(stats.invited)}
          icon={SendIcon}
        />
        <StatCard
          title={t("waitlistWaiting")}
          value={format.number(stats.total - stats.invited)}
          icon={HourglassIcon}
        />
      </div>

      {topReferrers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle as="h2" id={REFERRERS_TITLE_ID}>
              {t("waitlistReferrers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <List as="ol" aria-labelledby={REFERRERS_TITLE_ID}>
              {topReferrers.map((referrer) => (
                <ListRow
                  key={referrer.id}
                  title={referrer.email}
                  trailing={t("waitlistReferrals", { count: referrer.referralCount })}
                />
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle as="h2" id={ENTRIES_TITLE_ID}>
            {t("waitlistEntries")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <WaitlistAdminTable entries={data.entries} labelledBy={ENTRIES_TITLE_ID} />
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            hrefOf={hrefOf}
            label={t("waitlistPage", { page: data.page, total: data.totalPages })}
            previousLabel={t("waitlistPrevious")}
            nextLabel={t("waitlistNext")}
            className="mt-4 px-5"
          />
        </CardContent>
      </Card>
    </div>
  );
}
