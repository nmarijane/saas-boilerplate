"use client";

import type { Ref } from "react";
import type { SessionRecord, SessionsClient } from "../account-flows";
import { MonitorIcon, SmartphoneIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/features/auth/auth-client";
import { ListSkeleton } from "@/shared/components/data/skeletons";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { List, ListRow } from "@/shared/components/ui/list";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { toast } from "@/shared/components/ui/sonner";
import { reportHandledError } from "@/shared/utils/report-error";
import { revokeOtherSessionsFlow, revokeSessionFlow } from "../account-flows";

// The browser and the system, read from the user agent. The order matters:
// Edge and Opera say "Chrome" too, and Chrome says "Safari".
function parseBrowser(ua: string): string | null {
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("OPR") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  return null;
}

function parseOS(ua: string): string | null {
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Mac OS") || ua.includes("Macintosh")) return "macOS";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Linux")) return "Linux";
  return null;
}

function isMobile(ua: string): boolean {
  return ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone");
}

type SessionsStatus = "loading" | "failed" | "ready";

interface ActiveSessionsViewProps {
  status: SessionsStatus;
  sessions: SessionRecord[];
  /** The token of the session this page is read in: it is told, and cannot be revoked from here. */
  currentToken: string | null;
  /** The token of the session being revoked, whose button loads. */
  revoking: string | null;
  /** Every other session is being revoked: that button loads. */
  revokingAll: boolean;
  onRevoke: (token: string) => void;
  onRevokeAll: () => void;
  onRetry: () => void;
  /** The id of the title of the card, which names the list: a screen reader says "Sessions, list, 3 items". */
  labelledBy: string;
  /** The box that holds the buttons and the list, which can take the focus: where it goes when the button it was on is gone. */
  regionRef?: Ref<HTMLDivElement>;
}

// The sessions of the person, one row each: a tile for the kind of device, what
// it is ("Chrome on macOS"), a quiet badge on the one the person is using, the
// address and the date it began, and the button that ends it. The one in use has
// no button: signing out is the account menu's. "Revoke all other sessions" is
// there when there is another. A button says which session it ends, for those
// who hear it, as the rows would all read "Revoke". The sessions are read when
// the card mounts: a skeleton first, and a message with a retry when they could
// not be. A button that works loads and keeps its place and its focus; the
// others wait. The list is named by the title of its card, and the box around it
// can take the focus (`tabIndex={-1}`, never a tab stop, and no ring: nothing in
// it is to be pressed), for when the button that had it is revoked away.
export function ActiveSessionsView({
  status,
  sessions,
  currentToken,
  revoking,
  revokingAll,
  onRevoke,
  onRevokeAll,
  onRetry,
  labelledBy,
  regionRef,
}: ActiveSessionsViewProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  if (status === "loading") {
    return <ListSkeleton rows={2} />;
  }

  if (status === "failed") {
    return (
      <PageAlert
        tone="danger"
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => onRetry()}>
            {tCommon("retry")}
          </Button>
        }
      >
        {t("sessionsFailed")}
      </PageAlert>
    );
  }

  const busy = revoking !== null || revokingAll;
  const hasOthers = sessions.some(({ token }) => token !== currentToken);
  // Read in the browser, once the card is mounted: the time of day is the person's own
  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div
      ref={regionRef}
      tabIndex={-1}
      className="flex flex-col gap-3 focus:outline-hidden"
    >
      {hasOthers ? (
        <div className="flex sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={revokingAll}
            disabled={revoking !== null}
            onClick={() => onRevokeAll()}
          >
            {t("revokeAllSessions")}
          </Button>
        </div>
      ) : null}
      {sessions.length === 0 ? (
        <p className="text-body text-ink-muted">{tCommon("noResults")}</p>
      ) : (
        <List aria-labelledby={labelledBy}>
          {sessions.map((session) => {
            const current = session.token === currentToken;
            const ua = session.userAgent ?? "";
            const browser = parseBrowser(ua);
            const os = parseOS(ua);
            const device =
              browser && os
                ? t("sessionDevice", { browser, os })
                : (browser ?? os ?? t("unknownDevice"));
            const began = new Date(session.createdAt);

            return (
              <ListRow
                key={session.id}
                leading={
                  <IconTile
                    tone="neutral"
                    size="sm"
                    icon={isMobile(ua) ? SmartphoneIcon : MonitorIcon}
                  />
                }
                title={
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {device}
                    {current ? (
                      <Badge variant="neutral">{t("currentSession")}</Badge>
                    ) : null}
                  </span>
                }
                meta={
                  <>
                    {session.ipAddress ? `${session.ipAddress} · ` : null}
                    <time dateTime={began.toISOString()}>{when.format(began)}</time>
                  </>
                }
                trailing={
                  current ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={revoking === session.token}
                      disabled={busy && revoking !== session.token}
                      aria-label={t("revokeSessionOn", { device })}
                      onClick={() => onRevoke(session.token)}
                    >
                      {t("revokeSession")}
                    </Button>
                  )
                }
              />
            );
          })}
        </List>
      )}
    </div>
  );
}

interface ActiveSessionsProps {
  /** The id of the title of the card, which names the list. */
  labelledBy: string;
  /** The auth client: the page gives none (it is the app's own), and a story gives one that answers what it is told to. */
  client?: SessionsClient;
}

// Revoking removes the row once the server has ended the session, says so, and
// puts the focus on the box of the list: the button that had it is gone with its
// row (and "Revoke all other sessions" goes when no other session is left), and a
// focus that is not put somewhere falls to the body. "All the others" keeps the
// one in use (`revokeOtherSessionsFlow`). A revoke that fails says so and leaves
// the row, and the focus, where they were.
export function ActiveSessions({
  labelledBy,
  client = authClient,
}: ActiveSessionsProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionsStatus>("loading");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const region = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [listed, current] = await Promise.all([
        client.listSessions(),
        client.getSession(),
      ]);
      if (listed.error) {
        reportHandledError(listed.error);
        setStatus("failed");
        return;
      }
      setSessions(listed.data ?? []);
      setCurrentToken(current.data?.session.token ?? null);
      setStatus("ready");
    } catch (error) {
      // Handled with the alert, not hidden: the error reporter of the app still hears it.
      reportHandledError(error);
      setStatus("failed");
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = () => {
    setStatus("loading");
    void load();
  };

  const revoke = async (token: string) => {
    if (revoking !== null || revokingAll) {
      return;
    }

    setRevoking(token);
    if (await revokeSessionFlow(client, token)) {
      setSessions((all) => all.filter((session) => session.token !== token));
      toast.success(t("sessionsRevoked"));
      region.current?.focus();
    } else {
      toast.error(tCommon("error"));
    }
    setRevoking(null);
  };

  const revokeOthers = async () => {
    if (revoking !== null || revokingAll) {
      return;
    }

    setRevokingAll(true);
    if (await revokeOtherSessionsFlow(client)) {
      setSessions((all) =>
        all.filter((session) => session.token === currentToken),
      );
      toast.success(t("sessionsRevoked"));
      region.current?.focus();
    } else {
      toast.error(tCommon("error"));
    }
    setRevokingAll(false);
  };

  return (
    <ActiveSessionsView
      status={status}
      sessions={sessions}
      currentToken={currentToken}
      revoking={revoking}
      revokingAll={revokingAll}
      onRevoke={(token) => void revoke(token)}
      onRevokeAll={() => void revokeOthers()}
      onRetry={retry}
      labelledBy={labelledBy}
      regionRef={region}
    />
  );
}
