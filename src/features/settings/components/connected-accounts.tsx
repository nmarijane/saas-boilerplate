"use client";

import { GithubIcon, LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/features/auth/auth-client";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface Account {
  id: string;
  providerId: string;
}

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function ProviderIcon({ provider }: { provider: string }) {
  switch (provider) {
    case "google":
      return <GoogleIcon />;
    case "github":
      return <GithubIcon className="size-4" />;
    default:
      return null;
  }
}

export function ConnectedAccounts() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    const { data, error } = await authClient.listAccounts();
    if (error) {
      toast.error(error.message ?? tCommon("error"));
      setLoading(false);
      return;
    }
    setAccounts(data ?? []);
    setLoading(false);
  }, [tCommon]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const hasCredentialAccount = accounts.some(
    (account) => account.providerId === "credential",
  );
  const canDisconnect = accounts.length > 1;

  async function handleConnect(provider: ProviderId) {
    setActionLoading(provider);
    await authClient.linkSocial({
      provider,
      callbackURL: "/settings/profile",
    });
    setActionLoading(null);
  }

  async function handleDisconnect(providerId: string) {
    if (!canDisconnect && !hasCredentialAccount) {
      toast.error(t("cannotDisconnect"));
      return;
    }

    setActionLoading(providerId);
    const { error } = await authClient.unlinkAccount({ providerId });

    if (error) {
      toast.error(error.message ?? tCommon("error"));
      setActionLoading(null);
      return;
    }

    setAccounts((prev) => prev.filter((a) => a.providerId !== providerId));
    setActionLoading(null);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {PROVIDERS.map((provider) => {
        const linked = accounts.find((a) => a.providerId === provider.id);
        const isActionInProgress = actionLoading === provider.id;

        return (
          <div
            key={provider.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-3">
              <ProviderIcon provider={provider.id} />
              <span className="text-sm font-medium">{provider.label}</span>
              {linked && (
                <Badge variant="secondary">{t("connected")}</Badge>
              )}
            </div>

            {linked ? (
              <Button
                variant="outline"
                size="sm"
                disabled={!canDisconnect || isActionInProgress}
                onClick={() => handleDisconnect(provider.id)}
                title={!canDisconnect ? t("cannotDisconnect") : undefined}
              >
                {isActionInProgress ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  t("disconnect")
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={isActionInProgress}
                onClick={() => handleConnect(provider.id)}
              >
                {isActionInProgress ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  t("connect")
                )}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
