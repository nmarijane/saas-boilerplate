"use client";

import { useState } from "react";
import { UploadButton } from "@/features/upload/components/upload-button";
import { useUpload } from "@/features/upload/hooks/use-upload";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { submitFeedback } from "../actions";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  orgId?: string;
}

export function FeedbackModal({
  open,
  onOpenChange,
  userId = "",
  orgId = "",
}: FeedbackModalProps) {
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [screenshotId, setScreenshotId] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { upload, uploading } = useUpload({
    userId,
    orgId,
    onSuccess: (result) => {
      setScreenshotId(result.id);
      setScreenshotName(result.filename);
    },
  });

  const handleSubmit = async () => {
    if (!message.trim()) return;

    setSubmitting(true);
    await submitFeedback({
      userId,
      orgId: orgId || undefined,
      type,
      message,
      screenshotId: screenshotId ?? undefined,
    });

    setMessage("");
    setType("bug");
    setScreenshotId(null);
    setScreenshotName(null);
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedback-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="feedback-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="feature">Feature Request</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-message">Message</Label>
            <Textarea
              id="feedback-message"
              placeholder="Describe your feedback..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Screenshot (optional)</Label>
            <div className="flex items-center gap-2">
              <UploadButton
                accept="image/*"
                disabled={uploading}
                onFileSelect={(file) => upload(file)}
              >
                {uploading ? "Uploading..." : "Attach Screenshot"}
              </UploadButton>
              {screenshotName && (
                <span className="text-sm text-muted-foreground">
                  {screenshotName}
                </span>
              )}
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !message.trim()}
            className="w-full"
          >
            {submitting ? "Sending..." : "Send Feedback"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
