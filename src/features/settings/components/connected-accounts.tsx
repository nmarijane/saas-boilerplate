"use client";

import type {
  AccountRecord,
  AccountsClient,
  ProviderId,
} from "../account-flows";
import { GithubIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/features/auth/auth-client";
import { ListSkeleton } from "@/shared/components/data/skeletons";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { List, ListRow } from "@/shared/components/ui/list";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { toast } from "@/shared/components/ui/sonner";
import { reportHandledError } from "@/shared/utils/report-error";
import { linkProviderFlow, unlinkAccountFlow } from "../account-flows";

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
] as const satisfies readonly { id: ProviderId; label: string }[];

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

function ProviderIcon({ provider }: { provider: ProviderId }) {
  return provider === "google" ? <GoogleIcon /> : <GithubIcon />;
}

type AccountsStatus = "loading" | "failed" | "ready";

interface ConnectedAccountsViewProps {
  status: AccountsStatus;
  accounts: AccountRecord[];
  /** The provider whose button is working: its button loads, and the others wait. */
  busy: ProviderId | null;
  onConnect: (provider: ProviderId) => void;
  onDisconnect: (provider: ProviderId) => void;
  onRetry: () => void;
  /** The id of the title of the card, which names the list: a screen reader says "Connected accounts, list, 2 items". */
  labelledBy: string;
}

// The providers the person can sign in with, one row each: a tile with its mark,
// its name, "Connected" when it is linked (a quiet badge) and the button that
// links or unlinks it. The accounts are read when the card mounts, so the card
// is drawn as a skeleton first, and says so when they could not be read, with a
// way to try again. A button says whom it acts on, for those who hear it: two
// rows would otherwise both read "Connect". The last way to sign in cannot be
// unlinked: that button is disabled, and says why. A button that works loads and
// keeps its place and its focus, and the other waits. The list is named by the
// title of its card.
export function ConnectedAccountsView({
  status,
  accounts,
  busy,
  onConnect,
  onDisconnect,
  onRetry,
  labelledBy,
}: ConnectedAccountsViewProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const canDisconnect = accounts.length > 1;

  if (status === "loading") {
    return <ListSkeleton rows={PROVIDERS.length} />;
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
        {t("connectedAccountsFailed")}
      </PageAlert>
    );
  }

  return (
    <List aria-labelledby={labelledBy}>
      {PROVIDERS.map(({ id, label }) => {
        const linked = accounts.some((account) => account.providerId === id);

        return (
          <ListRow
            key={id}
            leading={
              <IconTile tone="neutral" size="sm">
                <ProviderIcon provider={id} />
              </IconTile>
            }
            title={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {label}
                {linked ? <Badge variant="neutral">{t("connected")}</Badge> : null}
              </span>
            }
            trailing={
              linked ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={busy === id}
                  disabled={!canDisconnect || (busy !== null && busy !== id)}
                  disabledReason={!canDisconnect ? t("cannotDisconnect") : undefined}
                  aria-label={t("disconnectProvider", { provider: label })}
                  onClick={() => onDisconnect(id)}
                >
                  {t("disconnect")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={busy === id}
                  disabled={busy !== null && busy !== id}
                  aria-label={t("connectProvider", { provider: label })}
                  onClick={() => onConnect(id)}
                >
                  {t("connect")}
                </Button>
              )
            }
          />
        );
      })}
    </List>
  );
}

interface ConnectedAccountsProps {
  /** The id of the title of the card, which names the list. */
  labelledBy: string;
  /** The auth client: the page gives none (it is the app's own), and a story gives one that answers what it is told to. */
  client?: AccountsClient;
}

// Linking leaves the app for the provider and comes back to the account page.
// When the server takes it the browser has started to leave, and the button
// keeps loading until it has gone: let go at once, it could be pressed again, and
// a second press would start a second link. It is let go again only when the
// server refuses (or does not answer), and when the browser brings the page back
// from its cache (the back button, from the provider), which is as it was left.
// An account is unlinked by its own id, as Better Auth 1.7 asks; that stays on the page.
export function ConnectedAccounts({
  labelledBy,
  client = authClient,
}: ConnectedAccountsProps) {
  const tCommon = useTranslations("common");
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [status, setStatus] = useState<AccountsStatus>("loading");
  const [busy, setBusy] = useState<ProviderId | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await client.listAccounts();
      if (error) {
        reportHandledError(error);
        setStatus("failed");
        return;
      }
      setAccounts(data ?? []);
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

  useEffect(() => {
    const comeBack = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setBusy(null);
      }
    };
    window.addEventListener("pageshow", comeBack);

    return () => window.removeEventListener("pageshow", comeBack);
  }, []);

  const retry = () => {
    setStatus("loading");
    void load();
  };

  const connect = async (provider: ProviderId) => {
    if (busy !== null) {
      return;
    }

    setBusy(provider);
    if (await linkProviderFlow(client, provider)) {
      // The browser is leaving for the provider: the button keeps loading, see above.
      return;
    }
    toast.error(tCommon("error"));
    setBusy(null);
  };

  const disconnect = async (provider: ProviderId) => {
    const account = accounts.find(({ providerId }) => providerId === provider);
    if (!account || accounts.length < 2 || busy !== null) {
      return;
    }

    setBusy(provider);
    if (await unlinkAccountFlow(client, account.id)) {
      setAccounts((all) => all.filter(({ id }) => id !== account.id));
    } else {
      toast.error(tCommon("error"));
    }
    setBusy(null);
  };

  return (
    <ConnectedAccountsView
      status={status}
      accounts={accounts}
      busy={busy}
      onConnect={(provider) => void connect(provider)}
      onDisconnect={(provider) => void disconnect(provider)}
      onRetry={retry}
      labelledBy={labelledBy}
    />
  );
}
