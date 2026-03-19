"use client";

import type { EventName } from "@/features/events/types";
import { CopyIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { createWebhookEndpointAction } from "../actions";

const AVAILABLE_EVENTS: { id: EventName; label: string }[] = [
  { id: "member.invited", label: "Member Invited" },
  { id: "member.removed", label: "Member Removed" },
  { id: "member.role_changed", label: "Member Role Changed" },
  { id: "organization.created", label: "Organization Created" },
  { id: "organization.updated", label: "Organization Updated" },
  { id: "organization.deleted", label: "Organization Deleted" },
  { id: "subscription.created", label: "Subscription Created" },
  { id: "subscription.updated", label: "Subscription Updated" },
  { id: "subscription.cancelled", label: "Subscription Cancelled" },
  { id: "payment.succeeded", label: "Payment Succeeded" },
  { id: "payment.failed", label: "Payment Failed" },
  { id: "api_key.created", label: "API Key Created" },
  { id: "api_key.revoked", label: "API Key Revoked" },
  { id: "webhook.created", label: "Webhook Created" },
  { id: "webhook.deleted", label: "Webhook Deleted" },
  { id: "feature_flag.updated", label: "Feature Flag Updated" },
  { id: "feedback.created", label: "Feedback Created" },
  { id: "upload.created", label: "Upload Created" },
];

interface CreateWebhookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  userId: string;
}

export function CreateWebhookModal({
  open,
  onOpenChange,
  orgId,
  userId,
}: CreateWebhookModalProps) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleEvent(event: string) {
    setEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event],
    );
  }

  function handleSubmit() {
    if (!url.trim() || events.length === 0) return;

    startTransition(async () => {
      const result = await createWebhookEndpointAction(orgId, userId, {
        url: url.trim(),
        events,
      });
      setCreatedSecret(result.secret);
    });
  }

  async function handleCopy() {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setUrl("");
      setEvents([]);
      setCreatedSecret(null);
      setCopied(false);
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {createdSecret ? "Webhook Created" : "Add Webhook Endpoint"}
          </DialogTitle>
        </DialogHeader>

        {createdSecret ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copy your signing secret now. You will not be able to see it again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-sm break-all">
                {createdSecret}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopy}>
                <CopyIcon />
                <span className="sr-only">Copy</span>
              </Button>
            </div>
            {copied && (
              <p className="text-sm text-green-600">Copied to clipboard!</p>
            )}
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://example.com/webhooks"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded border p-3">
                {AVAILABLE_EVENTS.map((event) => (
                  <label
                    key={event.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={events.includes(event.id)}
                      onCheckedChange={() => toggleEvent(event.id)}
                    />
                    {event.label}
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending || !url.trim() || events.length === 0}
              >
                {isPending ? "Creating..." : "Create Endpoint"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
