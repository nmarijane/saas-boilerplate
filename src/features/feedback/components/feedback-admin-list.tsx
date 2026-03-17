"use client";

import { Badge } from "@/shared/components/ui/badge";
import { capitalize } from "@/shared/utils/helpers";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { updateFeedbackStatus } from "../actions";

interface FeedbackItem {
  id: string;
  userId: string;
  type: string;
  message: string;
  status: string;
  createdAt: Date;
}

interface FeedbackAdminListProps {
  feedbacks: FeedbackItem[];
  onStatusFilter?: (status: string | undefined) => void;
  currentFilter?: string;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "destructive",
  reviewed: "outline",
  done: "default",
};

export function FeedbackAdminList({
  feedbacks,
  onStatusFilter,
  currentFilter,
}: FeedbackAdminListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Filter:</span>
        <div className="flex gap-1">
          {["all", "new", "reviewed", "done"].map((status) => (
            <Button
              key={status}
              variant={currentFilter === status || (!currentFilter && status === "all") ? "default" : "outline"}
              size="sm"
              onClick={() =>
                onStatusFilter?.(status === "all" ? undefined : status)
              }
            >
              {capitalize(status)}
            </Button>
          ))}
        </div>
      </div>

      {feedbacks.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No feedback items found.
        </p>
      ) : (
        <ul className="divide-y">
          {feedbacks.map((fb) => (
            <li key={fb.id} className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{fb.type}</Badge>
                    <Badge variant={statusColors[fb.status] ?? "secondary"}>
                      {fb.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(fb.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{fb.message}</p>
                </div>
                <Select
                  value={fb.status}
                  onValueChange={(value) =>
                    updateFeedbackStatus(fb.id, value as "new" | "reviewed" | "done")
                  }
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
