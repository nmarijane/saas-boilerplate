"use client";

import { useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { toast } from "@/shared/components/ui/sonner";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { useNotificationCenter } from "./notifications-provider";

// The one button of the Notifications page, which the page draws while
// something is unread. It marks everything read through the center, which tells
// the server and clears the bell at once (the count and its dot), and then reads
// the page again, so that the header, the rows and this button tell what the
// server holds: with nothing left to read the page draws the button no more.
//
// It loads while the server is told, and keeps its place and its focus; a second
// press waits for the first (a flag that is read at once, not the state, which
// is only seen at the next render: two presses before it would both be sent).
// The button is about to go: the focus is put on the page's main region first,
// so that it is not lost to the body and the next Tab starts from the page.
export function MarkAllReadButton() {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { markAllRead } = useNotificationCenter();
  const [pending, setPending] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const working = useRef(false);

  const markAll = async () => {
    if (working.current) {
      return;
    }

    working.current = true;
    setPending(true);
    try {
      await markAllRead();
    } catch (error) {
      unstable_rethrow(error);
      // Handled with the toast, not hidden: the error reporter of the app still hears it.
      toast.error(tCommon("error"));
      reportHandledError(error);
      return;
    } finally {
      working.current = false;
      setPending(false);
    }

    toast.success(t("markedAllRead"));
    button.current?.closest("main")?.focus();
    router.refresh();
  };

  return (
    <Button
      ref={button}
      type="button"
      loading={pending}
      onClick={() => void markAll()}
    >
      {t("markAllRead")}
    </Button>
  );
}
