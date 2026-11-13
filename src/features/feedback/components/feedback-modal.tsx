"use client";

import { useTranslations } from "next-intl";
import { useState } from "react"; // upload
import { UploadButton } from "@/features/upload/components/upload-button"; // upload
import { useUpload } from "@/features/upload/hooks/use-upload"; // upload
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label"; // upload
import { PageAlert } from "@/shared/components/ui/page-alert"; // upload
import { toast } from "@/shared/components/ui/sonner";
import { submitFeedback } from "../actions";
import { useFeedbackForm } from "../feedback-form-state";
import { FeedbackForm } from "./feedback-form";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the dialog has closed, to say where the focus goes. Radix gives
   * it back to the `Trigger` of a dialog, and this one has none (it is opened by
   * a button outside it, in the sidebar or in a header): left to Radix the focus
   * is dropped on the page body (WCAG 2.4.3). The handler gets the event Radix
   * waits on, and calls `preventDefault` on it.
   */
  onCloseAutoFocus?: (event: Event) => void;
  userId?: string; // upload
  orgId?: string;
}

// The feedback dialog, opened by the feedback button of the shell. Its author is
// the person in the session, which the server action reads. It stays mounted
// when it is closed, so that a message that was written is still there when it
// opens again, and so is the error of a send that was refused: the form
// (feedback-form-state.ts) keeps the message when the server refuses, tells the
// person, and thanks them when it takes the feedback.
export function FeedbackModal({
  open,
  onOpenChange,
  onCloseAutoFocus,
  userId = "", // upload
  orgId = "",
}: FeedbackModalProps) {
  const t = useTranslations("feedback");
  const [screenshot, setScreenshot] = useState<{ id: string; filename: string } | null>(null); // upload

  const { upload, uploading, error: uploadError, reset: resetUpload } = useUpload({ userId, orgId, onSuccess: setScreenshot }); // upload

  const { form, setType, setMessage, send } = useFeedbackForm({
    submit: ({ type, message }) =>
      submitFeedback({
        orgId: orgId || undefined,
        type,
        message,
        screenshotId: screenshot?.id, // upload
      }),
    onSent: () => {
      setScreenshot(null); // upload
      resetUpload(); // upload
      toast.success(t("success"));
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The title and the labels of the fields say what the dialog is: there is no description to give it. */}
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <FeedbackForm
          form={form}
          onTypeChange={setType}
          onMessageChange={setMessage}
          onSend={() => void send()}
        >
          {/* upload:start */}
          {/* The screenshot is the upload feature's: a project without it takes out this block and the lines that end with `// upload` (docs/SETUP.md, Phase 3). */}
          <div className="space-y-2">
            <Label>{t("screenshot")}</Label>
            <div className="flex items-center gap-2">
              <UploadButton
                accept="image/*"
                disabled={uploading}
                onFileSelect={(file) => upload(file)}
              >
                {uploading ? t("uploading") : t("attach")}
              </UploadButton>
              {screenshot && (
                <span className="text-sm text-muted-foreground">
                  {screenshot.filename}
                </span>
              )}
            </div>
            {/* A screenshot that is refused says why, in the language of the page, where the dialog says its other errors */}
            {uploadError ? <PageAlert tone="danger">{uploadError}</PageAlert> : null}
          </div>
          {/* upload:end */}
        </FeedbackForm>
      </DialogContent>
    </Dialog>
  );
}
