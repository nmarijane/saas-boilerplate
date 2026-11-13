"use client";

import type { ReactNode } from "react";
import type { FeedbackFormState } from "../feedback-form-state";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { PageAlert } from "@/shared/components/ui/page-alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { MESSAGE_MAX_LENGTH } from "../feedback-form-state";

interface FeedbackFormProps {
  form: FeedbackFormState;
  onTypeChange: (type: string) => void;
  onMessageChange: (message: string) => void;
  onSend: () => void;
  /** What a project adds to the form (an attachment): it comes between the message and the button. */
  children?: ReactNode;
}

// The fields of the feedback dialog, as a function of the state it is given: the
// kind, the message (as long as the server accepts), what a project adds, then
// the error of a refused send and the button. The button is loading while the
// feedback is sent, not disabled: it keeps the focus, so that a keyboard user
// who pressed it is still on it when it says that the send failed, and can press
// it again. The error is an alert, announced when it appears; the message is
// kept in its field.
export function FeedbackForm({
  form,
  onTypeChange,
  onMessageChange,
  onSend,
  children,
}: FeedbackFormProps) {
  const t = useTranslations("feedback");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="feedback-type">{t("type")}</Label>
        <Select value={form.type} onValueChange={onTypeChange}>
          <SelectTrigger id="feedback-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bug">{t("bug")}</SelectItem>
            <SelectItem value="feature">{t("feature")}</SelectItem>
            <SelectItem value="other">{t("other")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="feedback-message">{t("message")}</Label>
        <Textarea
          id="feedback-message"
          placeholder={t("placeholder")}
          value={form.message}
          onChange={(event) => onMessageChange(event.target.value)}
          rows={4}
          maxLength={MESSAGE_MAX_LENGTH}
          readOnly={form.sending}
        />
      </div>
      {children}
      {form.failed ? <PageAlert tone="danger">{t("failed")}</PageAlert> : null}
      {/* The send is called with nothing: the click event is not its business. */}
      <Button
        type="button"
        onClick={() => onSend()}
        loading={form.sending}
        loadingText={t("sending")}
        disabled={form.message.trim() === ""}
        className="w-full"
      >
        {t("send")}
      </Button>
    </div>
  );
}
