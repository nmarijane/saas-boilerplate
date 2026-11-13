"use client";

import { useTranslations } from "next-intl";
import { TabLinks } from "@/shared/components/ui/tab-links";
import { useShell } from "./shell-context";

// The tabs of the settings pages, drawn from the view of the shell: each feature
// that has a settings page declared its tab, so a page does not list them. It
// goes above the content of every settings page, under its header. With no
// feature that gives a settings page there is nothing to switch between, and
// nothing is drawn.
export function SettingsNav() {
  const { settings } = useShell();
  const t = useTranslations("settings");

  if (settings.length === 0) {
    return null;
  }

  return (
    <TabLinks
      label={t("navLabel")}
      items={settings.map(({ href, label }) => ({ href, label }))}
    />
  );
}
