"use client";

import type { MouseEvent } from "react";
import type { getAllWaitlistEntries } from "../queries";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { toast } from "@/shared/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { inviteFromWaitlist } from "../actions";
import { inviteFlow } from "../invite-flow";

type Entry = Awaited<ReturnType<typeof getAllWaitlistEntries>>["entries"][number];

interface WaitlistAdminTableProps {
  entries: Entry[];
  /** The id of the title of the card the table sits in: it names the box the table scrolls in. */
  labelledBy?: string;
}

// None of the three is coloured: a status on a page of people is not the main
// information, and the words say it. Waiting is the quiet fill, invited an
// outline with its dot, joined an outline: three looks.
const statusLook = {
  waiting: { variant: "neutral", dot: false },
  invited: { variant: "outline", dot: true },
  joined: { variant: "outline", dot: false },
} as const;

// A status this table does not map (one a project adds) takes the quiet fill.
const unknownLook = { variant: "neutral", dot: false } as const;

function lookOf(status: string) {
  return Object.hasOwn(statusLook, status) ? statusLook[status as keyof typeof statusLook] : unknownLook;
}

// It sits in a card, edge to edge, so that its rules reach the edges: the text of
// its first and of its last column is 20 px in, as the title of the card is. Once
// everyone is invited the table holds no button, and the box that scrolls at a
// phone's width has nothing to take the focus: it is a region a tab reaches.
//
// An invitation shows the person invited, and the button of their row goes: the
// focus, which the button kept while it waited (it loads, it is not disabled), is
// put on the box that holds the table, as it is on the other lists, and does not
// fall on the page. It is put there only if it is still on the button (or nowhere):
// someone who moved on while the server answered keeps the place they chose.
export function WaitlistAdminTable({ entries, labelledBy }: WaitlistAdminTableProps) {
  const t = useTranslations("admin.waitlistTable");
  const format = useFormatter();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  // Those invited from here, shown invited at once: the page, read again, says it as well.
  // The rows come from the page, not from this state, so that another page of the list is drawn as it is.
  const [invited, setInvited] = useState<ReadonlySet<string>>(() => new Set());
  const container = useRef<HTMLDivElement>(null);

  const handleInvite = async (entryId: string, button: HTMLButtonElement) => {
    const sent = await inviteFlow(
      {
        invite: inviteFromWaitlist,
        pending: setLoading,
        invited: (id) => setInvited((previous) => new Set(previous).add(id)),
        refresh: () => router.refresh(),
        failed: () => toast.error(t("inviteFailed")),
      },
      entryId,
    );

    // The button is going with its status: the focus stays on the table, unless it was moved elsewhere meanwhile
    const { activeElement, body } = button.ownerDocument;
    if (sent && (activeElement === button || activeElement === body)) {
      container.current?.focus();
    }
  };

  return (
    <div ref={container} tabIndex={-1} className="focus:outline-hidden">
      <Table
        scrollLabelledBy={labelledBy}
        className="[&_tr>:first-child]:pl-5 [&_tr>:last-child]:pr-5"
      >
        <TableHeader>
          <TableRow>
            <TableHead>{t("email")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("referrals")}</TableHead>
            <TableHead>{t("referralCode")}</TableHead>
            <TableHead>{t("joined")}</TableHead>
            <TableHead className="text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const status = invited.has(entry.id) ? "invited" : entry.status;
            const look = lookOf(status);
            const date = entry.createdAt;

            return (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.email}</TableCell>
                <TableCell>
                  <Badge variant={look.variant} dot={look.dot}>
                    {/* A status this table has no word for (one a project adds) is told as it is written */}
                    {t.has(`statuses.${status}`) ? t(`statuses.${status}`) : status}
                  </Badge>
                </TableCell>
                <TableCell>{entry.referralCount}</TableCell>
                <TableCell className="font-mono">{entry.referralCode}</TableCell>
                <TableCell>
                  <time dateTime={date.toISOString()}>
                    {format.dateTime(date, { dateStyle: "medium" })}
                  </time>
                </TableCell>
                {/* No padding: the 48 px floor of the row holds the height, whatever the size of the button */}
                <TableCell className="py-0 text-right">
                  {status === "waiting" && (
                    <Button
                      size="sm"
                      variant="outline"
                      // It loads while the server answers, and keeps its place and its focus (a disabled button drops it)
                      loading={loading === entry.id}
                      onClick={(event: MouseEvent<HTMLButtonElement>) => void handleInvite(entry.id, event.currentTarget)}
                      // Every row has one: a screen reader tells them apart by the address
                      aria-label={t("inviteLabel", { email: entry.email })}
                    >
                      {t("invite")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {entries.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="h-24 text-center text-ink-muted">
                {t("empty")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
