"use client";

import type { getAllWaitlistEntries } from "../queries";
import { useState } from "react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { inviteFromWaitlist } from "../actions";

type Entry = Awaited<ReturnType<typeof getAllWaitlistEntries>>["entries"][number];

interface WaitlistAdminTableProps {
  entries: Entry[];
}

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  waiting: "secondary",
  invited: "default",
  joined: "outline",
};

export function WaitlistAdminTable({ entries }: WaitlistAdminTableProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [localEntries, setLocalEntries] = useState(entries);

  async function handleInvite(entryId: string) {
    setLoading(entryId);
    const result = await inviteFromWaitlist({ entryId });
    if (result.success) {
      setLocalEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, status: "invited" } : e)),
      );
    }
    setLoading(null);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Referrals</TableHead>
          <TableHead>Referral Code</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {localEntries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="font-medium">{entry.email}</TableCell>
            <TableCell>
              <Badge variant={statusVariant[entry.status] ?? "secondary"}>
                {entry.status}
              </Badge>
            </TableCell>
            <TableCell>{entry.referralCount}</TableCell>
            <TableCell className="font-mono text-sm">{entry.referralCode}</TableCell>
            <TableCell>
              {entry.createdAt.toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              {entry.status === "waiting" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleInvite(entry.id)}
                  disabled={loading === entry.id}
                >
                  {loading === entry.id ? "Inviting..." : "Invite"}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
        {localEntries.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              No waitlist entries yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
