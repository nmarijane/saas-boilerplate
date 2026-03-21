"use client";

import { LoaderCircleIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/features/auth/auth-client";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface Session {
  id: string;
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
}

function parseBrowser(ua: string): string {
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  return "Unknown";
}

function parseOS(ua: string): string {
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Mac OS") || ua.includes("Macintosh")) return "macOS";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Linux")) return "Linux";
  return "Unknown";
}

function parseDevice(ua: string): { browser: string; os: string; isMobile: boolean } {
  const browser = parseBrowser(ua);
  const os = parseOS(ua);
  const isMobile = ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone");
  return { browser, os, isMobile };
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActiveSessions() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionToken, setCurrentSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokeLoading, setRevokeLoading] = useState<string | null>(null);
  const [revokeAllLoading, setRevokeAllLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    const [sessionsResult, currentResult] = await Promise.all([
      authClient.listSessions(),
      authClient.getSession(),
    ]);

    if (sessionsResult.error) {
      toast.error(sessionsResult.error.message ?? tCommon("error"));
      setLoading(false);
      return;
    }

    setSessions((sessionsResult.data as Session[]) ?? []);
    if (currentResult.data?.session) {
      setCurrentSessionToken(currentResult.data.session.token);
    }
    setLoading(false);
  }, [tCommon]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  async function handleRevoke(token: string) {
    setRevokeLoading(token);
    const { error } = await authClient.revokeSession({ token });

    if (error) {
      toast.error(error.message ?? tCommon("error"));
      setRevokeLoading(null);
      return;
    }

    setSessions((prev) => prev.filter((s) => s.token !== token));
    toast.success(t("sessionsRevoked"));
    setRevokeLoading(null);
  }

  async function handleRevokeAll() {
    setRevokeAllLoading(true);
    const { error } = await authClient.revokeSessions();

    if (error) {
      toast.error(error.message ?? tCommon("error"));
      setRevokeAllLoading(false);
      return;
    }

    setSessions((prev) =>
      prev.filter((s) => s.token === currentSessionToken),
    );
    toast.success(t("sessionsRevoked"));
    setRevokeAllLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const otherSessions = sessions.filter(
    (s) => s.token !== currentSessionToken,
  );

  return (
    <div className="space-y-4">
      {otherSessions.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={revokeAllLoading}
            onClick={handleRevokeAll}
          >
            {revokeAllLoading ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              t("revokeAllSessions")
            )}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {sessions.map((session) => {
          const isCurrent = session.token === currentSessionToken;
          const device = session.userAgent
            ? parseDevice(session.userAgent)
            : null;
          const isRevoking = revokeLoading === session.token;

          return (
            <div
              key={session.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                {device?.isMobile ? (
                  <SmartphoneIcon className="text-muted-foreground size-5" />
                ) : (
                  <MonitorIcon className="text-muted-foreground size-5" />
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {device
                        ? `${device.browser} on ${device.os}`
                        : t("unknownDevice")}
                    </span>
                    {isCurrent && (
                      <Badge variant="default">{t("currentSession")}</Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    {session.ipAddress && <span>{session.ipAddress}</span>}
                    <span>{formatDate(session.createdAt)}</span>
                  </div>
                </div>
              </div>

              {!isCurrent && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isRevoking}
                  onClick={() => handleRevoke(session.token)}
                >
                  {isRevoking ? (
                    <LoaderCircleIcon className="size-4 animate-spin" />
                  ) : (
                    t("revokeSession")
                  )}
                </Button>
              )}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {tCommon("noResults")}
          </p>
        )}
      </div>
    </div>
  );
}
