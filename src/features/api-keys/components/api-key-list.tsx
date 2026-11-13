"use client";

import type { ReactNode } from "react";
import type { ApiKeyStatus } from "../key-status";
import { BanIcon, EllipsisIcon, KeyRoundIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { EmptyState } from "@/shared/components/data/empty-state";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { List, ListRow } from "@/shared/components/ui/list";
import { toast } from "@/shared/components/ui/sonner";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { revokeApiKeyAction } from "../actions";
import { KeyStatusBadge } from "./key-status-badge";

/**
 * A key as the Developers page gives it (`getApiKeysForOrg`): what is shown, and
 * nothing else. The hash of the key is not in what the query reads, its scopes
 * and its expiry are not shown, and the status is the page's word, worked out on
 * the server (`apiKeyStatus`). The dates are ISO strings.
 */
export interface ApiKeyItem {
  id: string;
  name: string;
  /** The first characters of the key: all of it that is fit to show. */
  prefix: string;
  status: ApiKeyStatus;
  createdAt: string;
  /** Null for a key that was never used. */
  lastUsed: string | null;
}

// Rows of the menu are 44 px high, where the shared row is 40: the menu is
// opened by a finger on a phone.
const itemStyles = "min-h-11";

interface KeyRowProps {
  orgId: string;
  item: ApiKeyItem;
  /** Some row of the list has a menu: this one, which has none, keeps the room of one, so that the badges line up. */
  reserveMenu: boolean;
  /** Puts the focus on the list: where it goes when the button it was on is gone. */
  focusList: () => void;
}

// A key: a tile, the name over what is known of it (the start of the key in
// mono, when it was made, when it was last used), and at the end its status in a
// badge, with the « ⋯ » menu for a key that is not revoked (an expired key has
// it too, and can still be revoked). Revoking asks first, as it cannot be taken
// back; the server revokes only a key of the workspace, and when it does not
// answer, the dialog stays open with its error toast. The page is read again
// once it is done, so that the row and the header tell what the server holds.
// The key stays in the list, revoked, and its button goes with the menu: the
// focus is put on the list.
function KeyRow({ orgId, item, reserveMenu, focusList }: KeyRowProps) {
  const t = useTranslations("apiKeys");
  const format = useFormatter();
  const router = useRouter();
  const [revoking, setRevoking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const revoked = useRef(false);

  // The confirmation rejects when the key is still open (the server refused, or
  // did not answer): the dialog then stays open with its error toast.
  const revoke = async () => {
    await revokeApiKeyAction(item.id, orgId);

    revoked.current = true;
    toast.success(t("revoked", { name: item.name }));
    router.refresh();
  };

  // The confirmation has no Radix `Trigger` to give the focus back to (Cancel
  // and Escape leave the person on this page): the button of the menu does,
  // unless the key was revoked, and then the button goes: the list keeps the focus.
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (revoked.current) {
      focusList();
    } else {
      trigger.current?.focus();
    }
  };

  // The dates are days, not moments: no time zone is configured, so the hour
  // would be the server's, and a reader elsewhere would take it for theirs.
  const on = (iso: string) => ({
    date: format.dateTime(new Date(iso), { dateStyle: "medium" }),
    time: (day: ReactNode) => <time dateTime={iso}>{day}</time>,
  });

  return (
    <ListRow
      leading={<IconTile tone="neutral" size="sm" icon={KeyRoundIcon} />}
      title={item.name}
      meta={
        <>
          <code className="font-mono">{item.prefix}…</code>{" "}
          <span aria-hidden="true">·</span>{" "}
          {t.rich("created", on(item.createdAt))}{" "}
          <span aria-hidden="true">·</span>{" "}
          {item.lastUsed
            ? t.rich("lastUsed", on(item.lastUsed))
            : t("neverUsed")}
        </>
      }
      trailing={
        <div className="flex items-center gap-3">
          <KeyStatusBadge status={item.status} />
          {item.status !== "revoked" ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    ref={trigger}
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("keyActions", { name: item.name })}
                  >
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  collisionPadding={8}
                  className="w-56"
                >
                  <DropdownMenuItem
                    variant="destructive"
                    className={itemStyles}
                    onSelect={() => setRevoking(true)}
                  >
                    <BanIcon aria-hidden="true" />
                    {t("revoke")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ConfirmDialog
                open={revoking}
                onOpenChange={setRevoking}
                tone="danger"
                title={t("revokeTitle", { name: item.name })}
                description={t("revokeDescription")}
                confirmLabel={t("revokeConfirm")}
                onCloseAutoFocus={restoreFocus}
                onConfirm={revoke}
              />
            </>
          ) : reserveMenu ? (
            <span aria-hidden="true" className="size-10 shrink-0" />
          ) : null}
        </div>
      }
    />
  );
}

interface ApiKeyListProps {
  /** The workspace the keys belong to: the page takes it from the session. */
  orgId: string;
  keys: ApiKeyItem[];
}

// The API keys of the workspace, as a card with a level-two title: one row each,
// the oldest first, as the page reads them; with none, an empty state says so
// under the title (the button that makes one is the header's, and is on the
// page: the state does not say it twice). The list is named by the title of its
// card. The box that holds the list, or the empty state, is what takes the focus
// when the button it was on is gone: it is drawn in both cases, as the box of the
// endpoints is, so that a page that swaps one for the other cannot drop the focus
// on the page. The rows that have no menu (the revoked ones) keep the room of one
// when others have it, so that the badges of the list line up on the right.
export function ApiKeyList({ orgId, keys }: ApiKeyListProps) {
  const t = useTranslations("apiKeys");
  const titleId = useId();
  const container = useRef<HTMLDivElement>(null);
  const anyMenu = keys.some(({ status }) => status !== "revoked");

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" id={titleId}>
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={container} tabIndex={-1} className="focus:outline-hidden">
          {keys.length === 0 ? (
            <EmptyState
              icon={KeyRoundIcon}
              title={t("empty.title")}
              description={t("empty.description")}
            />
          ) : (
            <List aria-labelledby={titleId}>
              {keys.map((item) => (
                <KeyRow
                  key={item.id}
                  orgId={orgId}
                  item={item}
                  reserveMenu={anyMenu}
                  focusList={() => container.current?.focus()}
                />
              ))}
            </List>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
