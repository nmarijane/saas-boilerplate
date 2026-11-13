"use client";

import type { ReactNode } from "react";
import type { ToggleEndpoint } from "../endpoint-flows";
import {
  EllipsisIcon,
  PlusIcon,
  Trash2Icon,
  WebhookIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useReducer, useRef, useState } from "react";
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
import { Switch } from "@/shared/components/ui/switch";
import { useRouter } from "@/shared/lib/i18n-navigation";
import {
  deleteWebhookEndpointAction,
  toggleWebhookEndpointAction,
} from "../actions";
import { toggleEndpointFlow } from "../endpoint-flows";
import { endpointSwitch, startSwitch } from "../endpoint-switch";
import { CreateWebhookModal } from "./create-webhook-modal";

/**
 * An endpoint as the Developers page gives it (`getWebhookEndpointsForOrg`):
 * what is shown, and nothing else. The signing secret is not in what the query
 * reads: it is told once, when the endpoint is added. The date is an ISO string.
 */
export interface WebhookItem {
  id: string;
  url: string;
  /** Whether events are delivered to it. */
  active: boolean;
  /** How many events it asks for. */
  eventCount: number;
  createdAt: string;
}

// Rows of the menu are 44 px high, where the shared row is 40: the menu is
// opened by a finger on a phone.
const itemStyles = "min-h-11";

interface EndpointRowProps {
  orgId: string;
  item: WebhookItem;
  /** Turns the delivery to the endpoint on or off on the server. */
  toggle: ToggleEndpoint;
  /** Puts the focus on the list: where it goes when the button it was on is gone. */
  focusList: () => void;
}

// An endpoint: a tile, its address over what is known of it (how many events it
// asks for, when it was added), and at the end the switch that turns its delivery
// on and off, with the « ⋯ » menu that deletes it. The switch starts where the
// page read it and follows the page when it is read again with another word (a
// change made elsewhere shows), unless the person's own change is on its way
// (`endpointSwitch` has the rules). It moves at once and goes back, with a toast,
// if the server did not do it; it is not disabled while it waits, as a disabled
// control drops the focus, and a second change waits for the first (a flag that is
// read at once, not the state, which is only seen at the next render). The row is
// not given a `key` that follows the state to do this: a row that is drawn again
// after one's own change would lose the switch that has the focus. Deleting asks
// first, as it cannot be taken back, and the signing secret goes with the
// endpoint; when the server does not answer, the dialog stays open with its error
// toast. The page is read again once it is done, and the button goes with the
// row: the focus is put on the list.
function EndpointRow({ orgId, item, toggle: toggleEndpoint, focusList }: EndpointRowProps) {
  const t = useTranslations("webhooks");
  const format = useFormatter();
  const router = useRouter();
  const [switched, dispatch] = useReducer(endpointSwitch, item.active, startSwitch);
  const [deleting, setDeleting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const toggling = useRef(false);
  const deleted = useRef(false);

  // The page says another word of the endpoint than the last it said: the
  // switch takes it, as the row is drawn again (an update made while drawing
  // is how a component follows what it is given, without a second pass).
  if (item.active !== switched.page) {
    dispatch({ type: "read", active: item.active });
  }

  const toggle = async (next: boolean) => {
    if (toggling.current) {
      return;
    }

    toggling.current = true;
    dispatch({ type: "ask", active: next });
    try {
      const done = await toggleEndpointFlow(
        { toggle: toggleEndpoint },
        { endpointId: item.id, orgId, active: next },
      );
      if (done) {
        dispatch({ type: "done" });
      } else {
        dispatch({ type: "refuse" });
        toast.error(t("toggleFailed"));
      }
    } finally {
      toggling.current = false;
    }
  };

  // The confirmation rejects when the endpoint is still there (the server
  // refused, or did not answer): the dialog then stays open with its error toast.
  const remove = async () => {
    await deleteWebhookEndpointAction(item.id, orgId);

    deleted.current = true;
    toast.success(t("deleted"));
    router.refresh();
  };

  // The confirmation has no Radix `Trigger` to give the focus back to (Cancel
  // and Escape leave the person on this page): the button of the menu does,
  // unless the endpoint is gone, and then so is the button: the list keeps the focus.
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (deleted.current) {
      focusList();
    } else {
      trigger.current?.focus();
    }
  };

  // The date is a day, not a moment: no time zone is configured, so the hour
  // would be the server's, and a reader elsewhere would take it for theirs.
  const added = {
    date: format.dateTime(new Date(item.createdAt), { dateStyle: "medium" }),
    time: (day: ReactNode) => <time dateTime={item.createdAt}>{day}</time>,
  };

  return (
    <ListRow
      leading={<IconTile tone="neutral" size="sm" icon={WebhookIcon} />}
      title={item.url}
      meta={
        <>
          {t("eventCount", { count: item.eventCount })}{" "}
          <span aria-hidden="true">·</span> {t.rich("added", added)}
        </>
      }
      trailing={
        <div className="flex items-center gap-3">
          <Switch
            checked={switched.shown}
            onCheckedChange={(next) => void toggle(next)}
            aria-label={t("toggle", { url: item.url })}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                ref={trigger}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("endpointActions", { url: item.url })}
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
                onSelect={() => setDeleting(true)}
              >
                <Trash2Icon aria-hidden="true" />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ConfirmDialog
            open={deleting}
            onOpenChange={setDeleting}
            tone="danger"
            title={t("deleteTitle")}
            description={t("deleteDescription", { url: item.url })}
            confirmLabel={t("deleteConfirm")}
            onCloseAutoFocus={restoreFocus}
            onConfirm={remove}
          />
        </div>
      }
    />
  );
}

interface WebhookListProps {
  /** The workspace the endpoints belong to: the page takes it from the session. */
  orgId: string;
  endpoints: WebhookItem[];
  /**
   * Turns the delivery to an endpoint on or off on the server. The page gives
   * nothing, and the action is called; a story, which has no server, gives one
   * that answers by itself (or refuses).
   */
  toggle?: ToggleEndpoint;
}

// The webhook endpoints of the workspace, as a card with a level-two title and,
// beside it, the secondary button that adds one (the page's one main action is
// the header's). One row each, the oldest first, as the page reads them; with
// none, an empty state says so under the title, and does not say the button
// twice. The list is named by the title of its card. The box that holds the list,
// or the empty state, is what takes the focus when the row it was on is gone: it
// is drawn in both cases, so that the last endpoint to go, which makes the page
// swap the list for the empty state, does not take the box with it and drop the
// focus on the page. The dialog the button opens gives the focus back to it.
export function WebhookList({
  orgId,
  endpoints,
  toggle = toggleWebhookEndpointAction,
}: WebhookListProps) {
  const t = useTranslations("webhooks");
  const titleId = useId();
  const container = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [adding, setAdding] = useState(false);

  // The dialog has no Radix `Trigger` to give the focus back to: the button does.
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    addButton.current?.focus();
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle as="h2" id={titleId}>
          {t("title")}
        </CardTitle>
        <Button
          ref={addButton}
          type="button"
          variant="outline"
          size="sm"
          aria-haspopup="dialog"
          aria-expanded={adding}
          onClick={() => setAdding(true)}
        >
          <PlusIcon aria-hidden="true" />
          {t("add")}
        </Button>
      </CardHeader>
      <CardContent>
        <div ref={container} tabIndex={-1} className="focus:outline-hidden">
          {endpoints.length === 0 ? (
            <EmptyState
              icon={WebhookIcon}
              title={t("empty.title")}
              description={t("empty.description")}
            />
          ) : (
            <List aria-labelledby={titleId}>
              {endpoints.map((item) => (
                <EndpointRow
                  key={item.id}
                  orgId={orgId}
                  item={item}
                  toggle={toggle}
                  focusList={() => container.current?.focus()}
                />
              ))}
            </List>
          )}
        </div>
      </CardContent>
      <CreateWebhookModal
        orgId={orgId}
        open={adding}
        onOpenChange={setAdding}
        onCloseAutoFocus={restoreFocus}
      />
    </Card>
  );
}
