import { SearchXIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/shared/components/data/empty-state";

// What a page under the shell draws when it does not exist (a project that is
// not in the workspace of the session, as much as one that never was): in the
// content of the shell, which stays drawn around it, with the way back to the
// home of the workspace. It holds the h1 of the page.
export default function ShellNotFound() {
  const t = useTranslations("states.notFound");

  return (
    <EmptyState
      icon={SearchXIcon}
      headingLevel={1}
      title={t("title")}
      description={t("description")}
      action={{ label: t("home"), href: "/dashboard" }}
    />
  );
}
