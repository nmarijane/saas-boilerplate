import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { changelogEntry } from "@/models";
import { Badge } from "@/shared/components/ui/badge";
import { db } from "@/shared/lib/DB";
import { webPageJsonLd } from "@/shared/lib/jsonld";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "marketing.changelog",
  });

  return generatePageMetadata(
    {
      title: t("title"),
      description: "See what's new in our latest updates.",
      path: "/changelog",
    },
    locale
  );
}

export default async function ChangelogPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "marketing.changelog",
  });

  let entries: Array<{
    id: string;
    title: string;
    content: string;
    version: string | null;
    publishedAt: Date | null;
  }> = [];

  try {
    entries = await db
      .select()
      .from(changelogEntry)
      .orderBy(desc(changelogEntry.publishedAt));
  } catch {
    // DB might not be ready yet
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            webPageJsonLd({
              name: t("title"),
              description: "See what's new in our latest updates.",
            })
          ),
        }}
      />

      <div className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>

          {entries.length === 0 ? (
            <p className="mt-8 text-muted-foreground">
              No changelog entries yet. Check back soon!
            </p>
          ) : (
            <div className="mt-12 space-y-12">
              {entries.map((entry) => (
                <article key={entry.id} className="relative border-l pl-6">
                  <div className="absolute -left-1.5 top-1.5 size-3 rounded-full bg-primary" />
                  <div className="flex items-center gap-3">
                    {entry.version && (
                      <Badge variant="outline">{entry.version}</Badge>
                    )}
                    {entry.publishedAt && (
                      <time
                        className="text-sm text-muted-foreground"
                        dateTime={entry.publishedAt.toISOString()}
                      >
                        {entry.publishedAt.toLocaleDateString(locale, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </time>
                    )}
                  </div>
                  <h2 className="mt-2 text-xl font-semibold">{entry.title}</h2>
                  <div className="mt-3 text-sm text-muted-foreground whitespace-pre-line">
                    {entry.content}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
