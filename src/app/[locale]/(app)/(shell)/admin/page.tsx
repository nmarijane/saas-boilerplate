import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { appPageMetadata, getShell } from "@/features/app-shell";
import { requireAdmin } from "@/features/auth/guards";
import { redirect } from "@/shared/lib/i18n-navigation";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return appPageMetadata(t("title"));
}

// The administration has no page of its own: its address is the address of its
// first page. Like every page of the admin it asks for a platform admin itself, as
// the guard of the layout is not run again on a navigation inside it, and before it
// reads anything, so that nobody else is told which pages the section has. It sends
// to the first page that the registry gives the section (the shell lists them in
// order, for the people who may see them), so that it follows a feature that is
// taken away instead of naming a page that may be gone, and answers a 404 when the
// section has none. The redirect is the localized one: the language of the page goes
// with it, which a bare path would leave to the proxy, a second hop.
export default async function AdminIndexPage({ params }: Props) {
  await requireAdmin();
  const { locale } = await params;
  const { view } = await getShell();
  const [first] = view.nav.admin;

  if (!first) {
    notFound();
  }

  redirect({ href: first.href, locale });
}
