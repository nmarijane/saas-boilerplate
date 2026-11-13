import { SearchXIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/shared/components/data/empty-state";
import { CenteredPage } from "@/shared/components/shell/centered-page";

// What an address of the language that no page answers draws (and a page that
// calls `notFound()` outside the shell): a page of its own, centered, with the
// logo and the way back to the home of the site. It holds the h1 of the page.
export default function LocaleNotFound() {
  const t = useTranslations("states.notFound");

  return (
    <CenteredPage>
      <EmptyState
        icon={SearchXIcon}
        headingLevel={1}
        title={t("title")}
        description={t("description")}
        action={{ label: t("home"), href: "/" }}
      />
    </CenteredPage>
  );
}
